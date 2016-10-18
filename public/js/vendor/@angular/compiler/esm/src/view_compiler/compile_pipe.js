/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { BaseException } from '../facade/exceptions';
import { isBlank } from '../facade/lang';
import { Identifiers, identifierToken } from '../identifiers';
import * as o from '../output/output_ast';
import { createPureProxy, getPropertyInView, injectFromViewParentInjector } from './util';
export class CompilePipe {
    constructor(view, meta) {
        this.view = view;
        this.meta = meta;
        this._purePipeProxyCount = 0;
        this.instance = o.THIS_EXPR.prop(`_pipe_${meta.name}_${view.pipeCount++}`);
        var deps = this.meta.type.diDeps.map((diDep) => {
            if (diDep.token.equalsTo(identifierToken(Identifiers.ChangeDetectorRef))) {
                return getPropertyInView(o.THIS_EXPR.prop('ref'), this.view, this.view.componentView);
            }
            return injectFromViewParentInjector(diDep.token, false);
        });
        this.view.fields.push(new o.ClassField(this.instance.name, o.importType(this.meta.type)));
        this.view.createMethod.resetDebugInfo(null, null);
        this.view.createMethod.addStmt(o.THIS_EXPR.prop(this.instance.name)
            .set(o.importExpr(this.meta.type).instantiate(deps))
            .toStmt());
    }
    static call(view, name, args) {
        var compView = view.componentView;
        var meta = _findPipeMeta(compView, name);
        var pipe;
        if (meta.pure) {
            // pure pipes live on the component view
            pipe = compView.purePipes.get(name);
            if (isBlank(pipe)) {
                pipe = new CompilePipe(compView, meta);
                compView.purePipes.set(name, pipe);
                compView.pipes.push(pipe);
            }
        }
        else {
            // Non pure pipes live on the view that called it
            pipe = new CompilePipe(view, meta);
            view.pipes.push(pipe);
        }
        return pipe._call(view, args);
    }
    get pure() { return this.meta.pure; }
    _call(callingView, args) {
        if (this.meta.pure) {
            // PurePipeProxies live on the view that called them.
            var purePipeProxyInstance = o.THIS_EXPR.prop(`${this.instance.name}_${this._purePipeProxyCount++}`);
            var pipeInstanceSeenFromPureProxy = getPropertyInView(this.instance, callingView, this.view);
            createPureProxy(pipeInstanceSeenFromPureProxy.prop('transform')
                .callMethod(o.BuiltinMethod.bind, [pipeInstanceSeenFromPureProxy]), args.length, purePipeProxyInstance, callingView);
            return o.importExpr(Identifiers.castByValue)
                .callFn([purePipeProxyInstance, pipeInstanceSeenFromPureProxy.prop('transform')])
                .callFn(args);
        }
        else {
            return getPropertyInView(this.instance, callingView, this.view).callMethod('transform', args);
        }
    }
}
function _findPipeMeta(view, name) {
    var pipeMeta = null;
    for (var i = view.pipeMetas.length - 1; i >= 0; i--) {
        var localPipeMeta = view.pipeMetas[i];
        if (localPipeMeta.name == name) {
            pipeMeta = localPipeMeta;
            break;
        }
    }
    if (isBlank(pipeMeta)) {
        throw new BaseException(`Illegal state: Could not find pipe ${name} although the parser should have detected this error!`);
    }
    return pipeMeta;
}
//# sourceMappingURL=compile_pipe.js.map
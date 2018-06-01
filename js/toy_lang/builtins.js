import {Value, Null, Primitive, Func, Class, Instance, Void} from './interpreter/ast/value.js';
import {Variable, StmtSequence, VariableAssign} from './interpreter/ast/statement.js';

export {BUILTINS};

const PARAM1 = new Variable('p1');
const PARAM2 = new Variable('p2');
const PARAM3 = new Variable('p3');

const PARAM_LT0 = [];
const PARAM_LT1 = [PARAM1];
const PARAM_LT2 = [PARAM1, PARAM2];
const PARAM_LT3 = [PARAM1, PARAM2, PARAM3];

// built-in functions

function func(name, node, params = PARAM_LT0) {
    return new Func(params, node, name);
}

function func0(name, node) {
    return func(name, node);
}

function func1(name, node) {
    return func(name, node, PARAM_LT1);
}

function func2(name, node) {
    return func(name, node, PARAM_LT2);
}

function func3(name, node) {
    return func(name, node, PARAM_LT3);
}

function invokeToString(context, instance) {
    if(instance.hasProperty('toString')) {
        let methodBodyStmt = instance.methodBodyStmt(context, 'toString');
        return methodBodyStmt.evaluate(context.childContext()).returnedValue.value;
    }
    
    return instance.toString();
}

function print(context, v) {
    context.output(v instanceof Instance ? invokeToString(context, v) : v.toString());
}

const Print = func1('print', {
    evaluate(context) {
        print(context, PARAM1.evaluate(context));
        return context;
    }
});
 
const Println = func1('println', {
    evaluate(context) {
        let argument = PARAM1.evaluate(context);
        if(argument !== Null) {
            print(context, argument);
        }

        context.output('\n');
        return context;
    }
});

const HasValue = func1('hasValue',{
    evaluate(context) {
        let bool = PARAM1.evaluate(context) === Null ? Primitive.BoolFalse : Primitive.BoolTrue;
        return context.returned(bool);
    }
});

const NoValue = func1('noValue', {
    evaluate(context) {
        let bool = PARAM1.evaluate(context) === Null ? Primitive.BoolTrue : Primitive.BoolFalse;
        return context.returned(bool);
    }
});
 
// built-in classes

class NativeObject extends Value {
    constructor(value) {
        super();
        this.value = value;
    }

    toString() {
        return `${this.value}`;
    }
}

function clz(name, methods) {
    return new Class(PARAM_LT0, StmtSequence.EMPTY, methods, name);
}

function self(context) {
    return context.variables.get('this');
}

function selfValue(context) {
    return self(context).getProperty('value').value;
}

function classBodyStmt(assigns) {
    if(assigns.length === 0) {
        return StmtSequence.EMPTY;
    }
    let [name, value] = assigns[0];
    return new StmtSequence(
        new VariableAssign(new Variable(name), value),
        classBodyStmt(assigns.slice(1))
    );
}

function delegate(context, clz, methodName, params) {
    return clz.prototype[methodName].apply(
        selfValue(context), 
        params.map(param => param.evaluate(context).value)
    );
}

function methodPrimitive(clz, methodName, params = PARAM_LT0) {
    return func(methodName, {
        evaluate(context) {
            return context.returned(
                new Primitive(
                    delegate(context, clz, methodName, params)
                )
            );
        }
    }, params);
}

function methodVoid(clz, methodName, params = PARAM_LT0) {
    return func(methodName, {
        evaluate(context) {
            delegate(context, clz, methodName, params);
            return context.returned(Void);
            
        }    
    }, params);
}

function methodSelf(clz, methodName, params = PARAM_LT0) {
    return func(methodName, {
        evaluate(context) {
            let value = delegate(context, clz, methodName, params);
            let instance = self(context);
            instance.setProperty('value', new NativeObject(value));
            return context.returned(instance);
        }
    }, params);
}

function methodNewSameType(clz, methodName, params = PARAM_LT0) {
    return func(methodName, {
        evaluate(context) {
            let value = delegate(context, clz, methodName, params);
            let origin = self(context);
            let instance = new Instance(origin.clz, new Map(origin.properties));
            instance.setProperty('value', new NativeObject(value));
            return context.returned(instance);
        }
    }, params);
}

class StringClass {
    static method0Primitive(methodName) {
        return methodPrimitive(String, methodName);
    }

    static method1Primitive(methodName) {
        return methodPrimitive(String, methodName, PARAM_LT1);
    }    

    static method2Primitive(methodName) {
        return methodPrimitive(String, methodName, PARAM_LT2);
    }       
}

StringClass.methods = new Map([
    ['init', func1('init', {
        evaluate(context) {
            let instance = self(context);
            instance.setProperty('value', PARAM1.evaluate(context));
            return context;
        }
    })],
    ['toUpperCase', StringClass.method0Primitive('toUpperCase')],   
    ['toLowerCase', StringClass.method0Primitive('toLowerCase')],
    ['toString', StringClass.method0Primitive('toString')],     
    ['trim', StringClass.method0Primitive('trim')],     
    ['charAt', StringClass.method1Primitive('charAt')],
    ['charCodeAt', StringClass.method1Primitive('charCodeAt')],
    ['codePointAt', StringClass.method1Primitive('codePointAt')],
    ['endsWith', StringClass.method2Primitive('endsWith')],
    ['startsWith', StringClass.method2Primitive('startsWith')],
    ['includes', StringClass.method2Primitive('includes')],
    ['indexOf', StringClass.method2Primitive('indexOf')],
    ['lastIndexOf', StringClass.method2Primitive('lastIndexOf')],
    ['substring', StringClass.method2Primitive('substring')],
    ['length', func0('length', {
        evaluate(context) {
            let value = selfValue(context);
            return context.returned(new Primitive(value.length));
        }    
    })]
]);

class ListClass {
    static method0Primitive(methodName) {
        return methodPrimitive(Array, methodName);
    }

    static method1Void(methodName) {
        return methodVoid(Array, methodName, PARAM_LT1);
    }         
    
    static method1Primitive(methodName) {
        return methodPrimitive(Array, methodName, PARAM_LT1);
    }  

    static method2NewList(methodName) {
        return methodNewSameType(Array, methodName, PARAM_LT2);
    }     
    
    static method3Self(methodName) {
        return methodSelf(Array, methodName, PARAM_LT3);
    }    
}

ListClass.methods = new Map([
    ['init', func1('init', {
        evaluate(context) {
            let value = PARAM1.evaluate(context).value;
            let nativeObj = new NativeObject(new Array(value ? value : 0));
            let instance = self(context);
            instance.setProperty('value', nativeObj);
            return context;
        }
    })],
    ['toString', ListClass.method0Primitive('toString')],
    ['indexOf', ListClass.method1Primitive('indexOf')],
    ['slice', ListClass.method2NewList('slice')],
    ['join', ListClass.method1Primitive('join')],
    ['fill', ListClass.method3Self('fill')],
    ['append', func1('append', {
        evaluate(context) {
            let arr = selfValue(context);
            let arg = PARAM1.evaluate(context);
            arr.push(arg);
            return context.returned(Void);
        }    
    })],
    ['get', func1('get', {
        evaluate(context) {
            let arr = selfValue(context);
            let idx = PARAM1.evaluate(context).value;
            return context.returned(arr[idx]);
        }    
    })],
    ['set', func2('set', {
        evaluate(context) {
            let arr = selfValue(context);
            let idx = PARAM1.evaluate(context).value;
            let elem = PARAM2.evaluate(context);
            arr[idx] = elem;
            return context.returned(Void);
        }    
    })],
    ['length', func0('length', {
        evaluate(context) {
            let arr = selfValue(context);
            return context.returned(new Primitive(arr.length));
        }    
    })],    
    ['isEmpty', func0('isEmpty', {
        evaluate(context) {
            let arr = selfValue(context);
            return context.returned(new Primitive(arr.length === 0));
        }    
    })]
]);

const BUILTINS = new Map([
    ['print', Print],
    ['println', Println],
    ['hasValue', HasValue],
    ['noValue', NoValue],
    ['String', clz('String', StringClass.methods)],
    ['List', clz('List', ListClass.methods)]
]); 
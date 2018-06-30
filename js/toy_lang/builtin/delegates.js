import {Native, Primitive, Void, Null, newInstance} from '../interpreter/ast/value.js';
import {PARAM1, PARAM2, PARAM_LT1, PARAM_LT2, PARAM_LT3} from './func_bases.js';
import {func0, func1, func2, format} from './func_bases.js';
import {methodPrimitive, methodVoid, methodSelf, methodNewSameType, self, delegate} from './class_bases.js';

export {StringClass, ListClass, NumberClass};

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

StringClass.EMPTY_STRING = new Primitive('');

StringClass.methods = new Map([
    ['init', func1('init', {
        evaluate(context) {
            const text = PARAM1.evaluate(context);
            self(context).internalNode = text === Null ? StringClass.EMPTY_STRING : text;
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
    ['slice', StringClass.method2Primitive('slice')],
    ['split', func2('split', {
        evaluate(context) {
            const arr = delegate(context, String, 'split', PARAM_LT2);
            const instance = ListClass.newInstance(context, arr.map(elem => new Primitive(elem)));
            return context.returned(instance);
        }
    })],
    ['length', func0('length', {
        evaluate(context) {
            const value = self(context).nativeValue();
            return context.returned(new Primitive(value.length));
        }    
    })],
    ['format', func0('format', {
        evaluate(context) {
            const value = self(context).nativeValue();
            const args = context.lookUpVariable('arguments').nativeValue();
            const str = format.apply(undefined, [value].concat(args.map(arg => arg.value)));
            return context.returned(new Primitive(str));
        }    
    })]
]);

class ListClass {
    static method0Primitive(methodName) {
        return methodPrimitive(Array, methodName);
    }

    static method0Self(methodName) {
        return methodSelf(Array, methodName);
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
    
    static newInstance(context, jsArray) {
        return newInstance(context, 'List', Native, jsArray);
    }

    static arrayCall(context, methodName, rightCallback, returnedCallback) {
        const arr = self(context).nativeValue();
        const fNode = PARAM1.evaluate(context).internalNode;
        try {
            const r = Array.prototype[methodName].call(arr, elem => {
                return fNode.call(context, [elem]).either(
                    leftContext => {
                        throw leftContext;
                    }, 
                    rightContext => rightCallback(rightContext)
                );
            });
            return context.returned(
                returnedCallback(r)
            );
        }
        catch(leftContext) {
            return leftContext;
        }
    }
}

ListClass.methods = new Map([
    ['init', func0('init', {
        evaluate(context) {
            const nativeObj = context.lookUpVariable('arguments').internalNode;
            self(context).internalNode = nativeObj;
            return context;
        }
    })],
    ['toString', ListClass.method0Primitive('toString')],
    ['slice', ListClass.method2NewList('slice')],
    ['join', ListClass.method1Primitive('join')],
    ['reverse', ListClass.method0Self('reverse')],       
    ['fill', ListClass.method3Self('fill')],
    ['add', func1('add', {
        evaluate(context) {
            const instance = self(context);
            const arg = PARAM1.evaluate(context);
            instance.nativeValue().push(arg);
            return context.returned(instance);
        }    
    })],
    ['get', func1('get', {
        evaluate(context) {
            const idx = PARAM1.evaluate(context).value;
            return context.returned(self(context).nativeValue()[idx]);
        }    
    })],
    ['set', func2('set', {
        evaluate(context) {
            const idx = PARAM1.evaluate(context).value;
            const elem = PARAM2.evaluate(context);
            self(context).nativeValue()[idx] = elem;
            return context.returned(Void);
        }    
    })],
    ['swap', func2('swap', {
        evaluate(context) {
            const idx1 = PARAM1.evaluate(context).value;
            const idx2 = PARAM2.evaluate(context).value;
            const instance = self(context);
            const arr = instance.nativeValue();
            const tmp = arr[idx1];
            arr[idx1] = arr[idx2];
            arr[idx2] = tmp;
            return context.returned(instance);
        }    
    })],    
    ['length', func0('length', {
        evaluate(context) {
            return context.returned(
                new Primitive(
                    self(context).nativeValue().length
                )
            );
        }    
    })],    
    ['isEmpty', func0('isEmpty', {
        evaluate(context) {
            return context.returned(
                Primitive.boolNode(
                    self(context).nativeValue().length === 0
                )
            );
        }    
    })],
    ['filter', func1('filter', {
        evaluate(context) {           
            return ListClass.arrayCall(context, 'filter', 
                rightContext => rightContext.returnedValue.value, 
                r => ListClass.newInstance(context, r)
            );
        }    
    })],
    ['map', func1('map', {
        evaluate(context) {
            return ListClass.arrayCall(context, 'map', 
                rightContext => rightContext.returnedValue, 
                r => ListClass.newInstance(context, r)
            );
        }    
    })],
    ['forEach', func1('forEach', {
        evaluate(context) {
            return ListClass.arrayCall(context, 'forEach', 
                rightContext => rightContext.returnedValue, 
                _ => Void
            );
        }    
    })],    
    ['all', func1('all', {
        evaluate(context) {
            return ListClass.arrayCall(context, 'every', 
                rightContext => rightContext.returnedValue.value, 
                r => Primitive.boolNode(r)
            );
        }    
    })],
    ['any', func1('any', {
        evaluate(context) {
            return ListClass.arrayCall(context, 'some', 
                rightContext => rightContext.returnedValue.value, 
                r => Primitive.boolNode(r)
            );            
        }    
    })],    
    ['find', func1('find', {
        evaluate(context) {
            return ListClass.arrayCall(context, 'find', 
                rightContext => rightContext.returnedValue.value, 
                r => r || Null
            );     
        }    
    })],  
    ['includes', func1('includes', {
        evaluate(context) {
            const arr = self(context).nativeValue();
            const target = PARAM1.evaluate(context);
            return context.returned(
                Primitive.boolNode(
                    arr.some(elem => elem.value === target.value)
                )
            );
        }    
    })],  
    ['indexOf', func1('indexOf', {
        evaluate(context) {
            const arr = self(context).nativeValue();
            const target = PARAM1.evaluate(context);
            return context.returned(
                new Primitive(
                    arr.map(elem => elem.value).indexOf(target.value)
                )
            );
        }    
    })],  
    ['lastIndexOf', func1('lastIndexOf', {
        evaluate(context) {
            const arr = self(context).nativeValue();
            const target = PARAM1.evaluate(context);
            return context.returned(
                new Primitive(
                    arr.map(elem => elem.value).lastIndexOf(target.value)
                )
            );
        }    
    })],      
    ['findIndex', func1('findIndex', {
        evaluate(context) {
            return ListClass.arrayCall(context, 'findIndex', 
                rightContext => rightContext.returnedValue.value, 
                r => new Primitive(r)
            );   
        }    
    })],  
    ['sort', func1('sort', {
        evaluate(context) {
            const instance = self(context);
            const arr = instance.nativeValue();

            if(arr.length !== 0) {                
                const comparator = PARAM1.evaluate(context);
                if(comparator === Null) {
                    arr.sort(
                        typeof (arr[0].value) === 'number' ? (n1, n2) => n1.value - n2.value : undefined
                    );
                }
                else {
                    const fNode = comparator.internalNode;
                    try {
                        arr.sort((elem1, elem2) => {
                            fNode.call(context, [elem1, elem2]).either(
                                leftContext => {
                                    throw leftContext;
                                }, 
                                rightContext => rightContext.returnedValue.value
                            );
                        });
                    } catch(leftContext) {
                        return leftContext;
                    }
                }
            }

            return context.returned(instance);
        }    
    })],   
    ['toString', func0('toString', {
        evaluate(context) {
            const arr = self(context).nativeValue();
            return context.returned(
                new Primitive(
                    arr.map(elem => elem.toString(context)).join()
                )
            );
        }    
    })]
]);

class NumberClass {}

NumberClass.methods = new Map();
NumberClass.constants = new Map([
    ['MAX_VALUE', Primitive.of(Number.MAX_VALUE)],
    ['MIN_VALUE', Primitive.of(Number.MIN_VALUE)],
    ['NaN', Primitive.of(Number.NaN)],
    ['POSITIVE_INFINITY', Primitive.of(Number.POSITIVE_INFINITY)],
    ['NEGATIVE_INFINITY', Primitive.of(Number.NEGATIVE_INFINITY)]
]);
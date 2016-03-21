/// <reference path="../typings/main.d.ts" />
import ts=require("./typesystem")
import {Status} from "./typesystem";
import {PropertyIs} from "./restrictions";
import _=require("underscore")
import xmlio=require("./xmlio")
export class MetaInfo extends ts.TypeInformation{


    constructor(private _name: string,private _value: any,inhertitable:boolean=false){
        super(inhertitable)
    }

    value(){
        return this._value;
    }

    requiredType(){
        return ts.ANY;
    }
    facetName(){
        return this._name;
    }
}
export class Description extends MetaInfo{

    constructor(value:string){
        super("description",value)
    }
}
export  class NotScalar extends MetaInfo{
    constructor(){
        super("notScalar",true)
    }
}
export class DisplayName extends MetaInfo{


    constructor(value:string){
        super("displayName",value)
    }
}
export class Usage extends MetaInfo{


    constructor(value:string){
        super("usage",value)
    }
}
export class Annotation extends MetaInfo{

    constructor(name: string,value:any){
        super(name,value)
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        var tp=registry.get(this.facetName());
        if (!tp){
            return new Status(Status.ERROR,0,"using unknown annotation type:"+this.facetName());
        }
        var q=this.value();
        if (!q){
            if (tp.isString()){
                q="";
            }
        }
        var valOwner=tp.validateDirect(q,true);
        if (!valOwner.isOk()){
            return new Status(Status.ERROR,0,"invalid annotation value"+valOwner.getMessage());
        }
        return ts.OK_STATUS;
    }
}
export class FacetDeclaration extends MetaInfo{

    constructor(private name: string,private _type:ts.AbstractType,private optional:boolean){
        super(name,_type,true)
    }

    isOptional(){
        return this.optional;
    }
    type():ts.AbstractType{
        return this._type;
    }
}
export class CustomFacet extends MetaInfo{

    constructor(name: string,value:any){
        super(name,value,true)
    }
}
function parseExampleIfNeeded(val:any,type:ts.AbstractType):any{
    if (typeof val==='string'){
        if (type.isObject()||type.isArray()){
            var exampleString:string=val;
            var firstChar = exampleString.trim().charAt(0);
            if (firstChar=="{"||firstChar=="[") {
                try {
                    return JSON.parse(exampleString);
                } catch (e) {

                }
            }
            if (firstChar=="<") {
                try {
                    return xmlio.readObject(exampleString,type);
                } catch (e) {

                }
            }
        }
    }
    return val;
}
export class Example extends MetaInfo{
    constructor(value:any){
        super("example",value)
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        var valOwner=this.owner().validateDirect(parseExampleIfNeeded(this.value(),this.owner()),true);
        if (!valOwner.isOk()){
            var c= new Status(Status.ERROR,0,"using invalid `example`:"+valOwner.getMessage());
            valOwner.getErrors().forEach(x=>c.addSubStatus(x));
            return c;
        }
        return ts.OK_STATUS;
    }

    example():any{
        return parseExampleIfNeeded(this.value(),this.owner());
    }
}
export class Required extends MetaInfo{
    constructor(value:any){
        super("required",value)
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        if (typeof this.value()!=="boolean"){
            return new Status(Status.ERROR,0,"value of required facet should be boolean");
        }
        return ts.OK_STATUS;
    }
}
export class AllowedTargets extends MetaInfo{
    constructor(value:any){
        super("allowedTargets",value)
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status {

        return ts.OK_STATUS;
    }
}

export class Examples extends MetaInfo{
    constructor(value:any){
        super("examples",value)
    }

    examples():any[]{
        var v=this.value();
        var result:any[]=[];
        Object.keys(v).forEach(x=>{
            if (typeof v[x]=='object') {
                var example = parseExampleIfNeeded(v[x].content, this.owner());
                result.push(example);
            }
        });
        return result;
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        if (typeof this.value()==='object'){
            var rs=new Status(Status.OK,0,"");
            var v=this.value();
            Object.keys(v).forEach(x=>{
                if (typeof v[x]=='object') {
                    var example = parseExampleIfNeeded(v[x].content, this.owner());
                    rs.addSubStatus(this.owner().validateDirect(example,true));
                    Object.keys(v[x]).forEach(key=>{
                        if (key.charAt(0)=='('&&key.charAt(key.length-1)==')'){
                            var a=new Annotation(key.substring(1,key.length-1),v[x][key]);
                            rs.addSubStatus(a.validateSelf(registry));
                        }
                    });
                }
            });
            return rs;
        }
        else{
            return new Status(Status.ERROR,0,"examples should be a map");
        }
    }
}

export class XMLInfo extends MetaInfo{
    constructor(o:any){
        super("xml",o)
    }
}

export class Default extends MetaInfo{

    constructor(value:any){
        super("default",value)
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        var valOwner=this.owner().validateDirect(this.value(),true);
        if (!valOwner.isOk()){
            return new Status(Status.ERROR,0,"using invalid `defaultValue`:"+valOwner.getMessage());
        }
        return ts.OK_STATUS;
    }

}
export class Discriminator extends ts.TypeInformation{

    constructor(public property: string){
        super(true);
    }

    requiredType(){
        return ts.OBJECT;
    }

    value(){
        return this.property;
    }
    facetName(){return "discriminator"}

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        if (!this.owner().isSubTypeOf(ts.OBJECT)){
            return new Status(Status.ERROR,0,"you only can use `discriminator` with object types")
        }
        var prop=_.find(this.owner().meta(),x=>x instanceof PropertyIs&& (<PropertyIs>x).propertyName()==this.value());
        if (!prop){
            return new Status(Status.ERROR,0,"Using unknown property: "+this.value()+" as discriminator");
        }
        if (!prop.value().isScalar()){
            return new Status(Status.ERROR,0,"It is only allowed to use scalar properties as discriminators");
        }
        return ts.OK_STATUS;
    }
}

export class DiscriminatorValue extends ts.TypeInformation{
    constructor(public _value: any){
        super(false);
    }
    facetName(){return "discriminatorValue"}

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        if (!this.owner().isSubTypeOf(ts.OBJECT)){
            return new Status(Status.ERROR,0,"you only can use `discriminator` with object types")
        }
        var ds=this.owner().oneMeta(Discriminator);
        if (!ds){
            return new Status(Status.ERROR,0,"you can not use `discriminatorValue` without declaring `discriminator`")
        }
        var prop=_.find(this.owner().meta(),x=>x instanceof PropertyIs&& (<PropertyIs>x).propertyName()==ds.value());
        if (prop){
            var sm=prop.value().validate(this.value());
            if (!sm.isOk()){
                return new Status(Status.ERROR,0,"using invalid `disciminatorValue`:"+sm.getMessage());
            }
        }
        return ts.OK_STATUS;
    }

    requiredType(){
        return ts.OBJECT;
    }
    value(){
        return this._value;
    }
}
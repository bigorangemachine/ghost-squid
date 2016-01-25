//if(!module || !module.exports){var module={'exports':{}};}//for console testing
module.exports.check_strip_last=function(stringIn,checkFor){
	var output="";
	if(typeof(stringIn)==='string' && (stringIn.indexOf(checkFor)!==-1)){//found
		var startPoint=stringIn.length-checkFor.length,
            tmp=stringIn.substr(startPoint,checkFor.length);
		if(tmp==checkFor){
            output=stringIn.substr(0,(stringIn.length-checkFor.length));}
		else{
            output=stringIn;}		
		return output;
	}else{
		return stringIn;}
}
module.exports.check_strip_first=function(stringIn,checkFor){
	var output="";
	if(typeof(stringIn)==='string' && (stringIn.indexOf(checkFor)!==-1)){//found
		var startPoint=stringIn.length-checkFor.length,
		tmp=stringIn.substr(0,checkFor.length);
		if(tmp==checkFor){
			output=stringIn.substr(checkFor.length,stringIn.length);}
		else{
			output=stringIn;}	
		return output;
	}else{
		return stringIn;}	
}
module.exports.basic_str=function(stringIn){//basic string check.  It a Number or a string? Is it empty?
	var tmp=stringIn;
	if(typeof(stringIn)==='string'){
		tmp=stringIn.trim();
		if(tmp.length>0){
			return true;}
		else{
			return false;}
	}else if(typeof(stringIn)=='number' && !isNaN(stringIn)){
		if(tmp.toString().length>0){
			return true;}
		else{
			return false;}
	}else{
		return false;}
};
module.exports.obj_valid_key=function(obj,key){
    var result=false;
    var empty_obj;
    if(obj instanceof Array){empty_obj=[];}//check for array first as an array comes up both as array and object
    else if(obj instanceof Object){empty_obj={};}
    else{return false;}
    if(typeof(empty_obj)=='undefined'){//instanceof didn't work! IE9!?
	    if(obj.constructor==Object){empty_obj={};}
	    else if(obj.constructor==Array){empty_obj=[];}
    }
    for(var k_e_y_check in obj){
	    var do_result='proceed';
	    for(var empty_key in empty_obj){
		    if(empty_key==k_e_y_check){do_result='continue';break;}}//it matches! So this key is a prototype

	    //if(typeof(empty_obj[k_e_y_check])!='undefined'){continue;}//trying to ignore prototypes <- ISSUE WITH IE9 Uuuuugggg
	    if(do_result=='continue'){continue;}
	    if(k_e_y_check===key){result=true;break;}
    }
    return result;
};
module.exports.array_redex=function(arrayIn){//if you unset an array it creates a hole in the index.  This reindexes your array
	if(typeof(arrayIn)!='object'){return false;}
	var is_valid_arr;//=undefined

	if(arrayIn instanceof Array){is_valid_arr=true;}//check for array first as an array comes up both as array and object
	else if(arrayIn instanceof Object){is_valid_arr=false;}
	if(typeof(is_valid_arr)=='undefined'){//instanceof didn't work! IE9!?
		if(arrayIn.constructor==Object){is_valid_arr=true;}
		else if(arrayIn.constructor==Array){is_valid_arr=false;}
	}
	if(typeof(is_valid_arr)=='undefined'){is_valid_arr=(Object.prototype.toString.call(arrayIn) === '[object Array]');}
	
	if(is_valid_arr!==true){return false;}
	var old=arrayIn.concat([]),
		output=[];//break live link
	for(var k in old){
		if(this.obj_valid_key(old,k)){//valid key?! 
			output.push(old[k]);}}//all brackets's closed here
	return output;
};
module.exports.array_keys=function(objIn){//shallow get key
	if(typeof(objIn)=='object'){
		var output=[];
		for(var _a_r_r_a_y_key_test in objIn){
			if(this.obj_valid_key(objIn,_a_r_r_a_y_key_test)){output.push(_a_r_r_a_y_key_test);}
		}
		return (output.length===0?false:output);
	}
	return false;
};
module.exports.in_array=function( elem, arr, i ) {//stolen from jQuery
	return arr == null ? -1 : indexOf.call( arr, elem, i );
};
module.exports.in_object=function(valIn,objectIn){//similar to in_array
	for(var oKey in objectIn){
		if(this.obj_valid_key(objectIn,oKey)){
			if(objectIn[oKey]===valIn){return oKey;}
		}
	}
	return -1;
}
module.exports.array_object_search=function(arrIn,keyIn,valIn,doDebug){//if keyIn is an object it'll try reduce itself until it matches the key structure found
	if(typeof(arrIn)!=='object' || !arrIn instanceof Array){return [];}
	var output=[],
		key_index=(typeof(keyIn)==='object'?this.array_keys(keyIn):[]);
	for(var ai=0;ai<arrIn.length;ai++){
		if(typeof(keyIn)!=='object'){//not an object! Not a problem! Just do!
//if(doDebug){console.log('keyIn('+typeof(keyIn)+'): ',keyIn,"\n",'arrIn['+ai+']: ',arrIn[ai]);}
			if(this.obj_valid_key(arrIn[ai],keyIn)){
//if(doDebug){console.log('array_object_search obj test ',keyIn,' TEST: (',arrIn[ai][keyIn],' === ',valIn,': ',(arrIn[ai][keyIn]===valIn || arrIn[ai][keyIn]==valIn?'TRUE':'FALSE'),')');}
				if(arrIn[ai][keyIn]===valIn){output.push(arrIn[ai]);}
				else if(arrIn[ai][keyIn]==valIn){output.push(arrIn[ai]);}
			}
		}else{//sifting down through the provided key
			for(var ki=0;ki<key_index.length;ki++){
				var is_reduced=(typeof(keyIn[key_index[ki]])=='object'?false:true),//did we get reduced to a scalar value?  Basically anything but an object.  We might want a function!
					tmp=this.array_object_search([ (is_reduced?arrIn[ai]:arrIn[ai][ (key_index[ki]) ]) ],(is_reduced?key_index[ki]:keyIn[key_index[ki]]),valIn,doDebug);
				if(tmp.length>0){output.push(arrIn[ai]);}
			}
		}
	}
	return output;
};
module.exports.url_chomp=function(str,chompMore){
	if(!chompMore){chompMore=[];}
	if(typeof(chompMore)!='object'){chompMore=[];}
	var chop=['https', 'http', '//', '://'];
	if(chompMore.length>0){chop=chop.concat(chompMore);}
	for(var c=0;c<chop.length;c++){
		str=this.check_strip_first(str, chop[c]);}
	return str;
};
module.exports.get_ext=function(str){
    if(typeof(str)!=='string'){return str;}
    var ex_qry=str.split('?'),
        str_clean=(str.indexOf('?')!==-1?ex_qry[0]:str),
        ex_ahr=str_clean.split('#');
    str_clean=(str_clean.indexOf('#')!==-1?ex_ahr[0]:str_clean);
    if(str_clean.indexOf('.')===-1){return '';}
	var exp=str_clean.split('.');
    return exp[exp.length-1];
};
module.exports.alpha_num_inc=function(str,charRange){
    if(!this.basic_str(str)){str='';}
    if(typeof(charRange)!=='object'){charRange=[97,122];}//65-90 A-Z || 97-122 a-z
    charRange=charRange.concat([]);
    if(charRange.length===1){
        if(charRange[0]>=97 && charRange[0]<122){charRange.push(122);}
        else if(charRange[0]>=65 && charRange[0]<90){charRange.push(90);}
        
    }
    if(charRange.length<2){return false;}
    var new_str='',
        next_inc=0;
    for(var i=str.length-1;i>=0;i--){//reverse loop
        if((str[i].charCodeAt(0)+1)>charRange[1]){//does incrementing exceed character range
            next_inc++;
            new_str=String.fromCharCode(charRange[0])+new_str;//set to min
        }else{
            if(next_inc>0){
                next_inc--;
                if((str[i].charCodeAt(0)+1)>charRange[1]){//does incrementing exceed character range
                    next_inc++;
                    new_str=String.fromCharCode(charRange[0])+new_str;
                }else{//otherwise increment normally
                    new_str=String.fromCharCode( (str[i].charCodeAt(0)+1) )+new_str;
                }
            }else{
                if(new_str.length===0){//if first pop on
                    if((str[i].charCodeAt(0)+1)>charRange[1]){//does incrementing exceed character range
                        next_inc++;
                        new_str=String.fromCharCode(charRange[0])+new_str;
                    }else{//otherwise increment normally
                        new_str=String.fromCharCode( (str[i].charCodeAt(0)+1) )+new_str;
                    }
                }else{
                    new_str=str[i]+new_str;
                }                
            }
        }
    }
    if(next_inc>0){
        new_str=String.fromCharCode(charRange[0])+new_str;
    }
    return new_str;
};
module.exports.zero_pad_front=function(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
};
module.exports.is_scalar=function(arg) {
  return (/string|number|boolean/).test(typeof(arg));
};
module.exports.is_scalar=function(arg) {
  return (/string|number|boolean/).test(typeof(arg));
};

module.exports.delete_dir_all=function(fs,path) {//http://www.geedew.com/remove-a-directory-that-is-not-empty-in-nodejs/
//console.log('delete_dir_all - path: ',path);
    var self=this;
    if( fs.existsSync(path) ) {
//console.log(' --- path exists: ',path);
        fs.readdirSync(path).forEach(function(file,index){
            var curPath = path + "/" + file,
                stats=fs.statSync(curPath);

            if(stats.isDirectory()) { // recurse
//console.log(' --- path: ',path,' curPath ',curPath);
                self.delete_dir_all(fs,curPath);
            } else if(stats.isFile()) { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};
module.exports.get_auth_creds=function(urlStr, pkgObjs){
    var p_url=pkgObjs.url.parse(urlStr);//parsed url
//console.log('this.obj_valid_key(pkgObjs.config.auth_creds, p_url.host): ',this.obj_valid_key(pkgObjs.config.auth_creds, p_url.host),'pkgObjs.config.auth_creds',pkgObjs.config.auth_creds,'p_url.host',p_url.host);
    return (this.obj_valid_key(pkgObjs.config.auth_creds, p_url.host)?pkgObjs.config.auth_creds[ p_url.host ]:false);
};
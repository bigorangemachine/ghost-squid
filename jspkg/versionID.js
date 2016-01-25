module.exports = function(utils){
    var mysql_conn=false;//set inside of prototype setMySQLConn()
    function VersionID(opts){
        this._id=false;
        if(utils.obj_valid_key(opts,'mysql_conn') && typeof(opts.mysql_conn)==='object'){mysql_conn=opts.mysql_conn;}
        //plugin system
        this.plugin={//allows only for single functions
            'change':false
        };
        for(var k in this.plugin){
            if(utils.obj_valid_key(opts,'plugin') && utils.obj_valid_key(opts.plugin, k) && typeof(opts.plugin[k])==='function'){
                this.plugin[k]=opts.plugin[k];}}
        

        this.__defineGetter__('id', function(){ 
//console.log('id get',this._id);
            return this._id;
        });
        this.__defineSetter__('id', function(idIn){
            var self=this;
//console.log('id set',self._id);
            if(typeof(idIn)!=='number' && idIn!==false){//false is the unset tmp
                throw new Error("VersionID: id is not a number");
                return;}
            var old_val=self._id,
                trigger_ev=(old_val!==idIn?true:false);
            self._id=idIn;
            if(trigger_ev){self.change_indic(old_val,idIn);}
        });
        
        
        
        this.init();//start!
    }
    VersionID.prototype.init=function(){
    };
    VersionID.prototype.i_callback=function(hookIn,argsIn){//internal callback - pluginable hooks
        var self=this,
            has_callback=false;
        try{
            if(typeof(self.plugin[hookIn])==='function'){has_callback=true;}
        }catch(e){}
        if(has_callback){
            var args=[argsIn];//wrap in array for func.apply() but we use a variable so we can take advantage of PbR
            self.plugin[hookIn].apply(self, args);
            argsIn=args[0];//push values up
            return true;
        }
        return false;
    };
//    VersionID.prototype.onchange=function(){
//        var self=this;
//    };
    VersionID.prototype.setMySQLConn=function(db){//we didn't pass the deb through the inital declartion because other functions needed to 'hook into' this object
        if(!mysql_conn && typeof(db)==='object'){mysql_conn=db;return true;}
        return false;
    };
    VersionID.prototype.verify=function(resolve,reject){
        var self=this;
console.log('self.id',self.id);
        if(self.id===false){
            mysql_conn.query('SELECT COUNT(*) AS row_count FROM `versions`;',function(err,resp){
                var error_base='VERSION_ID CHECK ERROR ';
                if(err){
                    reject(error_base + err.message);}
                else if(resp){
                    if(resp[0].row_count>0){
                        mysql_conn.query('SELECT `versions`.id AS id FROM `versions` ORDER BY date_created DESC LIMIT 0,1;',function(err,resp){
                            var error_base='VERSION_ID FIND ERROR ';
                            if(err){
                                reject(error_base + err.message);}
                            else if(resp){
                                if(resp.length>0 && resp[0].id){
                                    self.id=resp[0].id;//self.onchange();
                                    resolve();
                                }
                            }
                        });
                    }else if(resp[0].row_count===0){
                        var error_base='VERSION_ID ROW ERROR ';
                        reject(error_base + err.message + "\n"  + "Use Tool UI to start a Version or Supply a version-id as an argument/parameter");
                    }
                }
//console.log('====row_count: ',arguments);
            });
        }else{
            mysql_conn.query('SELECT COUNT(*) AS row_count FROM `versions` WHERE `versions`.id='+mysql_conn.escape(self.id)+';',function(err,resp){
                var error_base='VERSION_ID VERIFY ERROR ';
                if(err){
                    reject(error_base + err.message);return;}
                else if(resp){
//console.log("resp[0].row_count",resp[0].row_count);
                    if(resp[0].row_count===1){//only 1 please
                        resolve();}
                    else{//otherwise thrown an error
                        reject(error_base + ' - ROW COUNT '+resp[0].row_count);}
                    return;//nothing else!
                }
                reject(error_base + ' - UNKNOWN');//????!?!?!?????!?
            });
        }
    };
    VersionID.prototype.change_indic=function(oldId, idIn){
        var self=this;
	
        ///////\\\\\\\\\\PLUGIN HOOK change\\\\\\\\/////////
        var _args={'oldId': oldId, 'idIn': idIn},//index keys mimic scope variables that should be passed
            key_list=utils.array_keys(_args),
            _vr='';
        self.i_callback('change',_args);
        for(var kl=0;kl<key_list.length;kl++){_vr=key_list[kl];eval(_vr+' = _args.'+_vr+';');}delete key_list;delete _vr;//populate into this scope
        ///////\\\\\\\\\\END PLUGIN HOOK change\\\\\\\\/////////
    };
    VersionID.prototype.thread_str=function(prefixStr){
        var self=this;
        var out_str=utils.check_strip_last(prefixStr, '-'+self.id.toString())+'-' + self.id.toString();
        return out_str;
    };
    
    
    
    return VersionID;
};
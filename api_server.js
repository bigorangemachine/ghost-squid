var _ = require('underscore'),//http://underscorejs.org/
    merge = require('merge'),//allows deep merge of objects
    mysql = require('mysql'),//https://github.com/felixge/node-mysql/
    fs = require('fs'),
    url = require('url'),
    express=require('express'),
    JSON = require('JSON');
var indexerDB = require('./jspkg/indexerDB'),
    utils = require('./jspkg/utils'),
    vars = require('./jspkg/vars');

var doc_root='',
    version_obj={
        'id':false,
        'onchange':function(){},
        'thread_str':function(prefixStr){
            var out_str=utils.check_strip_last(prefixStr, '-'+this.id.toString())+'-' + this.id.toString();
            return out_str;
        }
    },
    root_params={'config':'./config','do_reset':false, 'silent':true, 'found_params':[]};

var config=require('./jspkg/configurator')(process, fs, _, utils, root_params, version_obj);
doc_root=root_params.doc_root;

var mysql_conn = mysql.createConnection({
        'database':config.db.db,
        'host': config.db.host,
        'user': config.db.user,
        'password': config.db.pass
    });
mysql_conn.version=config.db.version;
var startup_msg=function(){
        console.log("We have started our server on port "+config.api_server.port);
        var show_uris=[],console_output='Serving: ';
        if(typeof(config.api_server.uri)==='string'){show_uris.push(config.api_server.uri);}
        else{
            for(var k in config.api_server.uri){
                if(utils.obj_valid_key(config.api_server.uri, k)){
                    show_uris.push(config.api_server.uri[k]);}}}
        
        if(show_uris.length>0){
            for(var i=0;i<show_uris.length;i++){
                console_output=console_output+"\n"+(i+1)+":\t"+
                    'http'+(config.api_server.port==443 || config.api_server.default_hostname.substring(0, 8).toLowerCase()==='https://'?'s':'')+'://'+
                    utils.url_chomp(config.api_server.default_hostname)+
                    (config.api_server.port!=80 && config.api_server.port!=443?':'+config.api_server.port:'')+
                    show_uris[i];
            }
            console.log(console_output);
        }
    },
    indexer_DB_obj = new indexerDB({'doc_root':doc_root,'mysql':mysql_conn}),
    app=express(),
    server=app.listen(config.api_server.port, function(){//start server
        startup_msg();//code refactor... too sloppy... bad scoping if left here
        
        mysql_conn.connect(function(err){
            app.get(config.api_server.uri, function(req,res){
                var throw_error=function(msg){
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({'result':{'type':'error','message':msg}}));
                    console.log("================ "+(new Date).toISOString().replace(/z|t/gi,' ')+"SENT DATA ================\n",JSON.stringify({'result':{'type':'error','message':msg}}));//process.exit();
                },
                send_success=function(data){
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({'result':{'type':'success'},'data':data}));
                    console.log("================ "+(new Date).toISOString().replace(/z|t/gi,' ')+"SENT DATA ================\n",JSON.stringify({'result':{'type':'success'},'data':data}));//process.exit();
                };
                if(err){
                    console.error('[MYSQL] error connecting: ' , err.toString());
                    throw_error((typeof(err.message)==='string'?err.toString():'Unspecifiec MYSQL Connection Error'));return;
                }
                console.log("[MYSQL] GOOD TO GO!");
                var found_data=[];
                indexer_DB_obj.api_view_instance({
                    'error':function(errorObj){
//console.log('err',errorObj);
                        //console.log(JSON.stringify({'result':{'type':'error','message':(typeof(errorObj.message)==='string'?errorObj.message:'Unspecifiec Error')}}));
                        //console.log('INDEXER DB ERROR: ',errorObj);
                        throw_error((typeof(errorObj.message)==='string'?errorObj.message:'indexerDB: Unspecifiec Error'));
                        process.exit();
                    },
                    'result':function(res, row){
//console.log('onresult: row ',row);
                        found_data.push(merge(true,{},row));
                    },
                    'end':function(){
                        send_success(found_data);//process.exit();
                    }
                });
            });
        });
    });

server.on('error',function(ev){
    if(ev.code==="EADDRINUSE"){
        console.log("[HEALTHY-ERROR\t@"+(new Date).toISOString().replace(/z|t/gi,' ')+"] Server Start Up Error. - Port "+config.api_server.port+" busy ");
    }else{
        console.log("[ERROR] Server Start Up Error. - ",ev.toString());
    }
});
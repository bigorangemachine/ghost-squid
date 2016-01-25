var config={};
config.db = {'type':'mysql','user':'ghost-squid','pass':'!root','host':'localhost','db':'gSquid','version':'5.6'
    //,'doc_root':'/Users/McOrange/localhost/www/CSS_indexer'//pm2 no cwd :(
};
config.auth_creds = {
    'private.yoursite.com':{'user':'admin','pass':'*123Password!'}
};
config.init_url = 'http://private.yoursite.com/';
config.domain_list = ['://private.yoursite.com/','://www.yoursite.com/','://yoursite.com/','https://secure.yoursite.com/'];
config.api_server = {'port':3000,'uri':'/','default_hostname':'localhost'};
config.step_timeout=250;
config.offset_size=8;
module.exports = config;
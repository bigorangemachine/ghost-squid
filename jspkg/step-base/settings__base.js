module.exports = function(config, utils){
    return {
        'init_method': ((utils.obj_valid_key(config,'init_method') && typeof(config.init_method)==='string') && (config.init_method.toUpperCase()==='POST' || config.init_method.toUpperCase()==='GET')?config.init_method:'GET'),
        'init_url': config.init_url
    };
};
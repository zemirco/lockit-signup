
/**
 * Module dependencies.
 */

var express = require('express');
var favicon = require('static-favicon');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var cookieSession = require('cookie-session');
var bodyParser = require('body-parser');
var csrf = require('csurf');
var errorHandler = require('errorhandler');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var lockitUtils = require('lockit-utils');
var Signup = require('../../index.js');

function start(config) {

  config = config || require('./config.js');

  var app = express();

  // set basedir so views can properly extend layout.jade
  app.locals.basedir = __dirname + '/views';

  // all environments
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  // make JSON output simpler for testing
  app.set('json spaces', 0);

  app.use(favicon());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded());
  app.use(cookieParser());
  app.use(cookieSession({
    secret: 'this is my super secret string'
  }));
  app.use(express.static(path.join(__dirname, 'public')));

  // testing csrf
  if (config.csrf) {
    app.use(csrf());
    app.use(function(req, res, next) {

      var token = req.csrfToken();
      res.locals._csrf = token;

      // save token to a cookie so we can easily access it on the client
      res.cookie('csrf', token);
      next();
    });
  }

  var db = lockitUtils.getDatabase(config);
  var adapter = require(db.adapter)(config);
  var signup = new Signup(config, adapter);

  app.use(signup.router);

  // development only
  if ('development' == app.get('env')) {
    app.use(errorHandler());
  }

  app.get('/', routes.index);
  app.get('/users', user.list);

  http.createServer(app).listen(app.get('port'));

  return app;

}

// export app for testing
if(require.main === module){
  // called directly
  start();
} else {
  // required as a module -> from test file
  module.exports = function(config) {
    return start(config);
  };
}

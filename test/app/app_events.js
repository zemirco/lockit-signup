
var path = require('path');
var http = require('http');
var express = require('express');
var superagent = require('superagent');
var should = require('should');
var uuid = require('node-uuid');
var utls = require('lockit-utils');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
var config = require('./config.js');
var Signup = require('../../');

var app = express();
app.locals.basedir = __dirname + '/app/views';
app.set('port', 6501);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cookieSession({
  secret: 'this is my super secret string'
}));
app.use(express.static(path.join(__dirname, 'public')));
var db = utls.getDatabase(config);
var adapter = require(db.adapter)(config);
var signup = new Signup(config, adapter);
app.use(signup.router);
http.createServer(app).listen(app.get('port'));


// create second app that manually handles responses
var config_two = JSON.parse(JSON.stringify(config));
config_two.signup.handleResponse = false;
var app_two = express();
app_two.locals.basedir = __dirname + '/app/views';
app_two.set('port', 6502);
app_two.set('views', __dirname + '/views');
app_two.set('view engine', 'jade');
app_two.use(bodyParser.urlencoded());
app_two.use(bodyParser.json());
app_two.use(cookieParser());
app_two.use(cookieSession({
  secret: 'this is my super secret string'
}));
app_two.use(express.static(path.join(__dirname, 'public')));
var signup_two = new Signup(config_two, adapter);
app_two.use(signup_two.router);
http.createServer(app_two).listen(app_two.get('port'));

describe('# event listeners', function() {

  var token = '';
  var token_two = '';

  before(function(done) {
    // create a user with verified email
    adapter.save('event', 'event@email.com', 'password', function() {
      // verify email for boat
      adapter.find('name', 'event', function(err, user) {
        token = uuid.v4();
        user.signupToken = token;
        // save updated user to db
        adapter.update(user, function(err, user) {
          // create second user
          adapter.save('event_two', 'event_two@email.com', 'password', function() {
            // verify email for boat
            adapter.find('name', 'event_two', function(err, user) {
              token_two = uuid.v4();
              user.signupToken = token_two;
              // save updated user to db
              adapter.update(user, done);
            });
          });
        });
      });
    });
  });

  var agent = superagent.agent();
  var agent_two = superagent.agent();

  describe('GET /signup/:token', function() {

    it('should emit a "signup" event on success', function(done) {
      signup.on('signup', function(user, res) {
        user.name.should.equal('event');
        user.email.should.equal('event@email.com');
        done();
      });
      agent
        .get('http://localhost:6501/signup/' + token)
        .end(function(err, res) {
          res.statusCode.should.equal(200);
        });
    });

  });

  describe('GET /signup/:token (handleResponse = false)', function() {

    it('should allow manual response handling', function(done) {
      signup_two.on('signup', function(user, res) {
        res.send('awesome');
      });
      agent_two
        .get('http://localhost:6502/signup/' + token_two)
        .end(function(err, res) {
          res.text.should.include('awesome');
          done();
        });
    });

  });

  after(function(done) {
    adapter.remove('event', function() {
      adapter.remove('event_two', done);
    });
  });

});

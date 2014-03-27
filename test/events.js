
var path = require('path');
var http = require('http');
var express = require('express');
var superagent = require('superagent');
var should = require('should');
var uuid = require('node-uuid');
var utls = require('lockit-utils');

var config = require('./app/config.js');
var Signup = require('../');

var app = express();
app.locals.basedir = __dirname + '/app/views';
app.set('port', 6501);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.urlencoded());
app.use(express.json());
app.use(express.cookieParser('your secret here'));
app.use(express.cookieSession());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
http.createServer(app).listen(app.get('port'));

var db = utls.getDatabase(config);
var adapter = require(db.adapter)(config);
var signup = new Signup(app, config, adapter);

// create second app that manually handles responses
var config_two = JSON.parse(JSON.stringify(config));
config_two.signup.handleResponse = false;
var app_two = express();
app_two.locals.basedir = __dirname + '/app/views';
app_two.set('port', 6502);
app_two.set('views', __dirname + '/views');
app_two.set('view engine', 'jade');
app_two.use(express.urlencoded());
app_two.use(express.json());
app_two.use(express.cookieParser('your secret here'));
app_two.use(express.cookieSession());
app_two.use(app_two.router);
app_two.use(express.static(path.join(__dirname, 'public')));
http.createServer(app_two).listen(app_two.get('port'));
var signup_two = new Signup(app_two, config_two, adapter);

describe('# event listeners', function() {

  var token = '';
  var token_two = '';

  before(function(done) {
    // create a user with verified email
    adapter.save('event', 'event@email.com', 'password', function() {
      // verify email for boat
      adapter.find('username', 'event', function(err, user) {
        token = uuid.v4();
        user.signupToken = token;
        // save updated user to db
        adapter.update(user, function(err, user) {
          // create second user
          adapter.save('event_two', 'event_two@email.com', 'password', function() {
            // verify email for boat
            adapter.find('username', 'event_two', function(err, user) {
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
        user.username.should.equal('event');
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
    adapter.remove('username', 'event', function() {
      adapter.remove('username', 'event_two', done);
    });
  });

});

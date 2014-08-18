
var superagent = require('superagent');
var should = require('should');
var uuid = require('node-uuid');

var config = require('./app/config.js');
config.port = 6501;
var app = require('./app/app.js');
var _app = app(config);

var config_two = JSON.parse(JSON.stringify(config));
config_two.port = 6502;
config_two.signup.handleResponse = false;
var _app_two = app(config_two);

describe('# event listeners', function() {

  var token = '';
  var token_two = '';
  var agent = superagent.agent();

  before(function(done) {
    // create a user with verified email
    _app._adapter.save('event', 'event@email.com', 'password', function(err, user) {
      if (err) console.log(err);
      // verify email for boat
      _app._adapter.find('name', 'event', function(err, user) {
        if (err) console.log(err);
        token = uuid.v4();
        user.signupToken = token;
        // save updated user to db
        _app._adapter.update(user, function(err, user) {
          if (err) console.log(err);
          // create second user
          _app._adapter.save('event_two', 'event_two@email.com', 'password', function() {
            // verify email for boat
            _app._adapter.find('name', 'event_two', function(err, user) {
              token_two = uuid.v4();
              user.signupToken = token_two;
              // save updated user to db
              _app._adapter.update(user, done);
            });
          });
        });
      });
    });
  });

  describe('GET /signup/:token', function() {

    it('should emit a "signup" event on success', function(done) {
      _app._signup.on('signup', function(user, res) {
        user.name.should.equal('event');
        user.email.should.equal('event@email.com');
        done();
      });
      agent
        .get('http://localhost:6501/signup/' + token)
        .end(function(err, res) {
          if (err) console.log(err);
          res.statusCode.should.equal(200);
        });
    });

  });

  describe('GET /signup/:token (handleResponse = false)', function() {

    it('should allow manual response handling', function(done) {
      _app_two._signup.on('signup', function(user, res) {
        res.send('awesome');
      });
      agent
        .get('http://localhost:6502/signup/' + token_two)
        .end(function(err, res) {
          res.text.should.containEql('awesome');
          done();
        });
    });

  });

  after(function(done) {
    _app._adapter.remove('event', function() {
      _app._adapter.remove('event_two', done);
    });
  });

});


var request = require('supertest');
var should = require('should');
var cookie = require('cookie');

var config = require('./app/config.js');
var app = require('./app/app.js');
var adapter = require('lockit-couchdb-adapter')(config);

// clone config object
var _config = JSON.parse(JSON.stringify(config));
_config.port = 8000;
_config.csrf = true;
_config.signup.tokenExpiration = '1 ms';

var _app = app(_config);

describe('# with csrf', function() {

  describe('GET /signup', function() {
    it('should include the token in the view', function(done) {
      request(_app)
          .get('/signup')
          .end(function(err, res) {
            var cookies = cookie.parse(res.headers['set-cookie'][0]);
            var token = cookies.csrf;
            res.text.should.include('name="_csrf" value="' + token + '"');
            done();
          });
    });
  });

  describe('GET /signup/resend-verification', function() {
    it('should include the token in the view', function(done) {
      request(_app)
          .get('/signup/resend-verification')
          .end(function(err, res) {
            var cookies = cookie.parse(res.headers['set-cookie'][0]);
            var token = cookies.csrf;
            res.text.should.include('name="_csrf" value="' + token + '"');
            done();
          });
    });
  });

  describe('GET /signup/:token', function() {
    it('should include the token in the view', function(done) {

      // need to create another adapter so token expires immediately
      var _adapter = require('lockit-couchdb-adapter')(_config);

      _adapter.save('csrf', 'csrf@email.com', 'pass', function() {
        _adapter.find('username', 'csrf', function(err, user) {
          request(_app)
              .get('/signup/' + user.signupToken)
              .end(function(err, res) {
                var cookies = cookie.parse(res.headers['set-cookie'][0]);
                var token = cookies.csrf;
                res.text.should.include('name="_csrf" value="' + token + '"');
                done();
              });
        });
      });
    });
  });

  after(function(done) {
    adapter.remove('csrf', done);
  });

});

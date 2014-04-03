
var request = require('supertest');
var should = require('should');

var config = require('./app/config.js');
var app = require('./app/app.js');
var adapter = require('lockit-couchdb-adapter')(config);

// create an app with rest enabled
var _config_one = JSON.parse(JSON.stringify(config));
_config_one.port = 6000;
_config_one.rest = true;
_config_one.signup.tokenExpiration = '10 ms';

// create a second app with longer token expiration
var _config_two = JSON.parse(JSON.stringify(_config_one));
_config_two.port = 6001;
_config_two.signup.tokenExpiration = '1 h';

var _app_one = app(_config_one);
var _app_two = app(_config_two);

describe('# with REST enabled', function() {

  describe('GET /signup', function() {

    it('should not handle the route when REST is active', function(done) {
      request(_app_one)
        .get('/rest/login')
        .end(function(error, res) {
          res.statusCode.should.equal(404);
          done();
        });
    });

  });

  describe('POST /signup', function() {

    it('should return an error when one input is blank (REST)', function(done) {
      request(_app_one)
        .post('/rest/signup')
        .send({username: '', email: 'some@email.com', password: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.equal('{"error":"All fields are required"}');
          done();
        });
    });

    it('should return an error when username contains non-url-safe chars (REST)', function(done) {
      request(_app_one)
        .post('/rest/signup')
        .send({username: 'name@', email: 'some@email.com', password: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.equal('{"error":"Username may not contain any non-url-safe characters"}');
          done();
        });
    });

    it('should return an error when email has invalid format (REST)', function(done) {
      request(_app_one)
        .post('/rest/signup')
        .send({username: 'some', email: 'someemail.com', password: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.equal('{"error":"Email is invalid"}');
          done();
        });
    });

    it('should render a success message when everything went fine (REST)', function(done) {
      request(_app_one)
        .post('/rest/signup')
        .send({username: 'steve', email: 'steve@wayne.com', password: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(204);
          done();
        });
    });

    it('should return an error message username is already taken (REST)', function(done) {
      request(_app_one)
        .post('/rest/signup')
        .send({username: 'steve', email: 'steve@wayne.com', password: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.equal('{"error":"Username already taken"}');
          done();
        });
    });

    it('should render a success message when duplicate email was found (REST)', function(done) {
      request(_app_one)
        .post('/rest/signup')
        .send({username: 'jeff', email: 'steve@wayne.com', password: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(204);
          done();
        });
    });

  });

  describe('GET /signup/:token', function() {

    it('should render 404 message when token is invalid (REST)', function(done) {
      request(_app_one)
        .get('/rest/signup/id123')
        .end(function(error, res) {
          res.statusCode.should.equal(404);
          done();
        });
    });

    it('should render an error message when signup token has expired (REST)', function(done) {

      // first sign up a new user -> beep
      request(_app_one)
        .post('/rest/signup')
        .send({username: 'beep', email: 'beep@wayne.com', password: 'secret'})
        .end(function(err, res) {

          // second get beep's signup token
          adapter.find('username', 'beep', function(err, user) {

            // third call url with token
            request(_app_one)
              .get('/rest/signup/' + user.signupToken)
              .end(function(error, res) {
                res.statusCode.should.equal(403);
                res.text.should.equal('{"error":"token expired"}');
                done();
              });

          });

        });

    });

    it('should render a success message when token is valid (REST)', function(done) {

      request(_app_two)
        .post('/rest/signup')
        .send({username: 'steward', email: 'steward@wayne.com', password: 'secret'})
        .end(function(error, res) {

          // get token for our test user 'steward'
          adapter.find('username', 'steward', function(err, user) {

            // request url with token
            request(_app_one)
              .get('/rest/signup/' + user.signupToken)
              .end(function(error, res) {
                res.statusCode.should.equal(204);
                done();
              });

          });

        });

    });

  });

  describe('GET /signup/resend-verification', function() {

    it('should not catch the route when REST is active', function(done) {
      request(_app_one)
        .get('/rest/signup/resend-verification')
        .end(function(error, res) {
          res.statusCode.should.equal(404);
          done();
        });
    });

  });

  describe('POST /signup/resend-verification', function() {

    it('should return an error when email has invalid format (REST)', function(done) {
      request(_app_one)
        .post('/rest/signup/resend-verification')
        .send({email: 'somewayne.com'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.equal('{"error":"Email is invalid"}');
          done();
        });
    });

    it('should render a success message when no existing user was found (REST)', function(done) {
      request(_app_one)
        .post('/rest/signup/resend-verification')
        .send({email: 'jim@wayne.com'})
        .end(function(error, res) {
          res.statusCode.should.equal(204);
          done();
        });
    });

    it('should render a succes message when email address is already verified (REST)', function(done) {
      request(_app_one)
        .post('/rest/signup/resend-verification')
        .send({email: 'steward@wayne.com'})
        .end(function(error, res) {
          res.statusCode.should.equal(204);
          done();
        });
    });


    it('should render a success message when email was sent (REST)', function(done) {
      // create new user but do not activate
      adapter.save('mike', 'mike@email.com', 'pass', function() {
        request(_app_one)
          .post('/rest/signup/resend-verification')
          .send({email: 'mike@email.com'})
          .end(function(error, res) {
            res.statusCode.should.equal(204);
            done();
          });
      });
    });

  });

  after(function(done) {
    adapter.remove('beep', function() {
      adapter.remove('steve', function() {
        adapter.remove('steward', function() {
          adapter.remove('mike', done);
        });
      });
    });
  });

});

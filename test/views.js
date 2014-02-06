
var request = require('supertest');
var should = require('should');

var config = require('./app/config.js');
var app = require('./app/app.js');
var adapter = require('lockit-couchdb-adapter')(config);

// create two apps
// - one: with very short token expiration time
// - two: with longer expiration time

// clone config object
var _config_one = JSON.parse(JSON.stringify(config));

// set some custom properties
_config_one.port = 4000;
_config_one.signup.tokenExpiration = '10 ms';
_config_one.signup.views = {
  signup:       'custom/signup',
  signedUp:     'custom/signed-up',
  linkExpired:  'custom/linkExpired',
  resend:       'custom/resend',
  verified:     'custom/verified'
};

var _config_two = JSON.parse(JSON.stringify(_config_one));
_config_two.signup.tokenExpiration = '1 h';
_config_two.port = 4001;

// create the apps
var _app_one = app(_config_one);
var _app_two = app(_config_two);

describe('# custom views', function() {

  describe('GET /signup', function() {

    it('should use the custom template', function(done) {
      request(_app_one)
        .get('/signup')
        .end(function(error, res) {
          res.statusCode.should.equal(200);
          res.text.should.include('<p>This is my custom view.</p>');
          done();
        });
    });

  });

  describe('POST /signup', function() {

    it('should use the custom template', function(done) {
      // request the second app with custom template
      request(_app_one)
        .post('/signup')
        .send({username: 'jeff', email: 'jeff@wayne.com', password: 'secret'})
        .end(function(error, res) {
          res.text.should.include('<p>Yes you did it!</p>');
          done();
        });
    });

  });

  describe('GET /signup/:token', function() {

    it('should render an error message when signup token has expired and use custom view', function(done) {

      // first sign up a new user -> jack
      request(_app_one)
        .post('/signup')
        .send({username: 'jack', email: 'jack@wayne.com', password: 'secret'})
        .end(function(err, res) {
          if (err) console.log(err);

          // second get jack's signup token
          adapter.find('username', 'jack', function(err, user) {
            if (err) console.log(err);

            // third call url with token
            request(_app_one)
              .get('/signup/' + user.signupToken)
              .end(function(error, res) {
                res.statusCode.should.equal(200);
                res.text.should.include('Nope, not valid anymore!');
                done();
              });

          });

        });

    });

    it('should render the custom template', function(done) {

      // first sign up a new user
      request(_app_two)
        .post('/signup')
        .send({username: 'jim', email: 'jim@wayne.com', password: 'secret'})
        .end(function(err, res) {
          if (err) console.log(err);

          // second get jim's signup token
          adapter.find('username', 'jim', function(err, user) {
            if (err) console.log(err);

            // third call url with token
            request(_app_two)
              .get('/signup/' + user.signupToken)
              .end(function(error, res) {
                res.text.should.include('You are awesome!');
                done();
              });

          });

        });

    });

  });

  describe('GET /signup/resend-verification', function() {

    it('should use the custom template', function(done) {
      request(_app_one)
        .get('/signup/resend-verification')
        .end(function(error, res) {
          res.text.should.include('Did not get it');
          done();
        });
    });

  });

  after(function(done) {
    adapter.remove('username', 'jeff', function() {
      adapter.remove('username', 'jim', function() {
        adapter.remove('username', 'jack', done);
      });
    });
  });

});
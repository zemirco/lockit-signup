
var request = require('supertest');
var should = require('should');
var cookie = require('cookie');

var config = require('./app/config.js');
var app = require('./app/app.js');
var adapter = require('lockit-couchdb-adapter')(config);

var _app = app(config);

describe('# default config', function() {

  describe('GET /signup', function() {

    it('should use the default route', function(done) {
      request(_app)
        .get('/signup')
        .end(function(err, res) {
          res.statusCode.should.equal(200);
          res.text.should.include('Signup');
          res.text.should.include('<title>Sign up</title>');
          done();
        });
    });

  });

  describe('POST /signup', function() {

    it('should return an error when one input is blank', function(done) {
      request(_app)
        .post('/signup')
        .send({username: '', email: 'john@wayne.com', password: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.include('All fields are required');
          done();
        });
    });

    it('should return an error when username contains non-url-safe chars', function(done) {
      request(_app)
        .post('/signup')
        .send({username: 'john@', email: 'john@wayne.com', password: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.include('Username may not contain any non-url-safe characters');
          done();
        });
    });

    it('should return an error when email has invalid format', function(done) {
      request(_app)
        .post('/signup')
        .send({username: 'john', email: 'johnwayne.com', password: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.include('Email is invalid');
          done();
        });
    });

    it('should render a success message when everything went fine', function(done) {
      request(_app)
        .post('/signup')
        .send({username: 'john', email: 'john@wayne.com', password: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(200);
          res.text.should.include('<title>Sign up - Email sent</title>');
          res.text.should.include('Email with verification link sent. Please check your inbox.');
          done();
        });
    });

    it('should return an error message username is already taken', function(done) {
      request(_app)
        .post('/signup')
        .send({username: 'john', email: 'john@wayne.com', password: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.include('<title>Sign up</title>');
          res.text.should.include('Username already taken');
          done();
        });
    });

    it('should render a success message when duplicate email was found', function(done) {
      request(_app)
        .post('/signup')
        .send({username: 'jeff', email: 'john@wayne.com', password: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(200);
          res.text.should.include('<title>Sign up - Email sent</title>');
          res.text.should.include('Email with verification link sent. Please check your inbox.');
          done();
        });
    });

  });

  describe('GET /signup/:token', function() {

    it('should render 404 message when token is invalid', function(done) {
      request(_app)
        .get('/signup/id123')
        .end(function(error, res) {
          res.statusCode.should.equal(404);
          res.text.should.include('Cannot GET /signup/id123');
          done();
        });
    });

    it('should render a success message when token is valid', function(done) {
      // get token for our test user 'john'
      adapter.find('username', 'john', function(err, user) {
        if (err) console.log(err);
        // request url with token
        request(_app)
          .get('/signup/' + user.signupToken)
          .end(function(error, res) {
            res.statusCode.should.equal(200);
            res.text.should.include('Sign up successfully completed');
            done();
          });
      });
    });

  });

  describe('GET /signup/resend-verification', function() {

    it('should render template with email input', function(done) {
      request(_app)
        .get('/signup/resend-verification')
        .end(function(error, res) {
          res.statusCode.should.equal(200);
          res.text.should.include('To activate your account you must first confirm your email address');
          res.text.should.include('<title>Resend verification email</title>');
          done();
        });
    });

  });

  describe('POST /signup/resend-verification', function() {

    it('should return an error when email has invalid format', function(done) {
      request(_app)
        .post('/signup/resend-verification')
        .send({email: 'johnwayne.com'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.include('Email is invalid');
          done();
        });
    });

    it('should render a success message when no existing user was found', function(done) {
      request(_app)
        .post('/signup/resend-verification')
        .send({email: 'jim@wayne.com'})
        .end(function(error, res) {
          res.statusCode.should.equal(200);
          res.text.should.include('Email with verification link sent');
          done();
        });
    });

    it('should render a succes message when email address is already verified', function(done) {
      request(_app)
        .post('/signup/resend-verification')
        .send({email: 'john@wayne.com'})
        .end(function(error, res) {
          res.statusCode.should.equal(200);
          res.text.should.include('Email with verification link sent');
          done();
        });
    });

    // marc has signed up but didn't visit /signup/:token
    it('should render a success message when email was sent', function(done) {
      adapter.save('marc', 'marc@email.com', 'pass', function() {
        request(_app)
          .post('/signup/resend-verification')
          .send({email: 'marc@email.com'})
          .end(function(error, res) {
            res.statusCode.should.equal(200);
            res.text.should.include('Email with verification link sent');
            done();
          });
      });
    });

  });

  after(function(done) {
    adapter.remove('john', function() {
      adapter.remove('marc', done);
    });
  });

});

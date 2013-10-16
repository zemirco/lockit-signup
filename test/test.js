
var request = require('supertest');
var should = require('should');
var nano = require('nano');

var config = require('./config.js');
var app = require('./app.js')(config);

var adapter = require('lockit-' + config.db + '-adapter')(config);

// clone config object
var secondConfig = JSON.parse(JSON.stringify(config));
// set some custom properties
secondConfig.signupRoute = '/signmeup';
secondConfig.port = 4000;
secondConfig.signupTokenExpiration = 10;

// create a second app with alternative config
var secondApp = require('./app.js')(secondConfig);

// start the test
describe('signup', function() {
  
  describe('GET /signup', function() {
    
    it('should use the default route when none is specified', function(done) {
      request(app)
        .get('/signup')
        .end(function(err, res) {
          res.statusCode.should.equal(200);
          res.text.should.include('Signup');
          res.text.should.include('<title>Sign up</title>');
          done();
        });
    });

    it('should use the route provided', function(done) {

      // request the second app with custom url
      request(secondApp)
        .get('/signmeup')
        .end(function(error, res) {
          res.statusCode.should.equal(200);
          res.text.should.include('Signup');
          res.text.should.include('<title>Sign up</title>');
          done();
        });

    });
    
  });
  
  describe('POST /signup', function() {
    
    it('should return an error when one input is blank', function(done) {
      request(app)
        .post('/signup')
        .send({username: '', email: 'john@wayne.com', password: 'secret', verification: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.include('All fields are required');
          done();
        });
    });
    
    it('should return an error when username contains non-url-safe chars', function(done) {
      request(app)
        .post('/signup')
        .send({username: 'john@', email: 'john@wayne.com', password: 'secret', verification: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.include('Username may not contain any non-url-safe characters');
          done();
        });
    });
    
    it('should return an error when email has invalid format', function(done) {
      request(app)
        .post('/signup')
        .send({username: 'john', email: 'johnwayne.com', password: 'secret', verification: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.include('Email is invalid');
          done();
        });
    });
    
    it('should return an error when password does not match verification', function(done) {
      request(app)
        .post('/signup')
        .send({username: 'john', email: 'john@wayne.com', password: 'secret', verification: 'notsame'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.include('Passwords don\'t match');
          done();
        });
    });
    
    // needs to be removed from db afterwards
    it('should render a success message when everything went fine', function(done) {
      request(app)
        .post('/signup')
        .send({username: 'john', email: 'john@wayne.com', password: 'secret', verification: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(200);
          res.text.should.include('<title>Sign up - Email sent</title>');
          res.text.should.include('Email with verification link sent. Please check your inbox.');
          done();
        });
    });

    it('should return an error message username is already taken', function(done) {
      request(app)
        .post('/signup')
        .send({username: 'john', email: 'john@wayne.com', password: 'secret', verification: 'secret'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.include('<title>Sign up</title>');
          res.text.should.include('Username already taken');
          done();
        });
    });

    it('should render a success message when duplicate email was found', function(done) {
      request(app)
        .post('/signup')
        .send({username: 'jeff', email: 'john@wayne.com', password: 'secret', verification: 'secret'})
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
      request(app)
        .get('/signup/id123')
        .end(function(error, res) {
          res.statusCode.should.equal(404);
          res.text.should.include('Cannot GET /signup/id123');
          done();
        });
    });

    it('should render an error message when signup token has expired', function(done) {

      // first sign up a new user -> jack
      request(secondApp)
        .post('/signmeup')
        .send({username: 'jack', email: 'jack@wayne.com', password: 'secret', verification: 'secret'})
        .end(function(err, res) {
          if (err) console.log(err);

          // second get jack's signup token
          adapter.find('username', 'jack', function(err, user) {
            if (err) console.log(err);

            // third call url with token
            request(secondApp)
              .get('/signmeup/' + user.signupToken)
              .end(function(error, res) {
                res.statusCode.should.equal(200);
                res.text.should.include('This link has expired');
                done();
              });

          });

        });

    });
    
    it('should render a success message when token is valid', function(done) {
      
      // get token for our test user 'john'
      adapter.find('username', 'john', function(err, user) {
        if (err) console.log(err);

        // request url with token
        request(app)
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
      request(app)
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
      request(app)
        .post('/signup/resend-verification')
        .send({email: 'johnwayne.com'})
        .end(function(error, res) {
          res.statusCode.should.equal(403);
          res.text.should.include('Email is invalid');
          done();
        });
    });
    
    it('should render a success message when no existing user was found', function(done) {
      request(app)
        .post('/signup/resend-verification')
        .send({email: 'jim@wayne.com'})
        .end(function(error, res) {
          res.statusCode.should.equal(200);
          res.text.should.include('Email with verification link sent');
          done();
        });
    });
    
    // john has an already verified email address
    it('should render a succes message when email address is already verified', function(done) {
      request(app)
        .post('/signup/resend-verification')
        .send({email: 'john@wayne.com'})
        .end(function(error, res) {
          res.statusCode.should.equal(200);
          res.text.should.include('Email with verification link sent');
          done();
        });
    });
    
    // jack has signed up but didn't visit /signup/:token
    it('should render a success message when email was sent', function(done) {
      request(app)
        .post('/signup/resend-verification')
        .send({email: 'jack@wayne.com'})
        .end(function(error, res) {
          res.statusCode.should.equal(200);
          res.text.should.include('Email with verification link sent');
          done();
        });
    });
    
  });
  
});

// remove user from db
after(function(done) {

  adapter.remove('username', 'john', function(err, res) {
    if (err) console.log(err);

    adapter.remove('username', 'jack', function(err, res) {
      if (err) console.log(err);
      console.log('users created during test were removed from db');
      done();

    });

  });

});
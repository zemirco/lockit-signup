
var request = require('supertest');
var should = require('should');

var config = require('./config.js');
var app = require('./app.js');
var adapter = require('lockit-couchdb-adapter')(config);

// start the test
describe('lockit-signup', function() {
  
  /**
   * default config tests 
   */
  
  describe('# default config', function() {

    var _app = app(config);
    
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

      adapter.remove('username', 'john', function(err, res) {
        if (err) console.log(err);

        adapter.remove('username', 'marc', function(err, res) {
          if (err) console.log(err);

          done();

        });

      });
      
    });
    
  });
  
  /**
   * custom routes
   */
  
  describe('# custom routes', function() {
    
    // use seperate config
    var _config = JSON.parse(JSON.stringify(config));
    _config.signup.route = '/signmeup';
    
    // create app for this test
    var _app = app(_config);
    
    before(function(done) {
      // create a user only for this test
      adapter.save('route', 'custom@route.com', 'pass', done);
    });
    
    describe('GET /signup', function() {

      it('should use the route provided', function(done) {
        request(_app)
          .get('/signmeup')
          .end(function(error, res) {
            res.statusCode.should.equal(200);
            res.text.should.include('<div class="panel-heading">Signup</div>');
            done();
          });
      });
      
    });
    
    describe('POST /signup', function() {

      it('should use the route provided', function(done) {
        request(_app)
          .post('/signmeup')
          .send({username: '', email: 'some@email.com', password: 'secret'})
          .end(function(error, res) {
            // we get an error but not 404
            res.statusCode.should.equal(403);
            done();
          });
      });
      
    });
    
    describe('GET /signup/:token', function() {

      it('should render a success message when token is valid', function(done) {
        adapter.find('username', 'route', function(err, user) {
          request(_app)
            .get('/signmeup/' + user.signupToken)
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
          .get('/signmeup/resend-verification')
          .end(function(error, res) {
            res.statusCode.should.equal(200);
            res.text.should.include('To activate your account you must first confirm your email address');
            done();
          });
      });
      
    });
    
    describe('POST /signup/resend-verification', function() {
      
      it('should return an error when email has invalid format', function(done) {
        request(_app)
          .post('/signmeup/resend-verification')
          .send({email: 'someemail.com'})
          .end(function(error, res) {
            // 403 but not 404
            res.statusCode.should.equal(403);
            done();
          });
      });
      
    });
    
    after(function(done) {
      adapter.remove('username', 'route', done);
    });
    
  });
  
  /**
   * rest enabled 
   */
  
  describe('# with REST enabled', function() {
    
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
            res.statusCode.should.equal(200);
            res.text.should.equal('OK');
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
            res.statusCode.should.equal(200);
            res.text.should.equal('OK');
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
                  res.statusCode.should.equal(200);
                  res.text.should.equal('OK');
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
            res.statusCode.should.equal(200);
            res.text.should.equal('OK');
            done();
          });
      });

      it('should render a succes message when email address is already verified (REST)', function(done) {
        request(_app_one)
          .post('/rest/signup/resend-verification')
          .send({email: 'steward@wayne.com'})
          .end(function(error, res) {
            res.statusCode.should.equal(200);
            res.text.should.equal('OK');
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
              res.statusCode.should.equal(200);
              res.text.should.equal('OK');
              done();
            });
        });
      });

    });
    
    after(function(done) {
      adapter.remove('username', 'beep', function() {
        adapter.remove('username', 'steve', function() {
          adapter.remove('username', 'steward', function() {
            adapter.remove('username', 'mike', done);
          });
        });
      });
    });
    
  });

  /**
   * custom views
   */
  describe('# custom views', function() {
    
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

  /**
   * csrf enabled tests
   */

  describe('# with csrf', function() {

    // clone config object
    var _config = JSON.parse(JSON.stringify(config));
    _config.port = 8000;
    _config.csrf = true;

    var _app = app(_config);
        
    describe('GET /signup', function() {
      
      it('should include the token in the view', function(done) {
        request(_app)
          .get('/signup')
          .end(function(err, res) {

            // dirty hack to get the cookie token
            var token = decodeURIComponent(res.header['set-cookie'][0].split(';')[0].substring(5));
            res.statusCode.should.equal(200);
            res.text.should.include(token);
            done();
          });
      });
      
    });
    
    describe('GET /signup/resend-verification', function() {
      it('should include the token in the view', function(done) {
        request(_app)
          .get('/signup')
          .end(function(err, res) {

            var token = decodeURIComponent(res.header['set-cookie'][0].split(';')[0].substring(5));
            res.statusCode.should.equal(200);
            res.text.should.include(token);
            done();
          });
      });
    });

  });
  
});
'use strict';

var app = angular.module('authApp', ['ui.router', 'satellizer']);

app.run(function(Auth) {
  Auth.getProfile();
});

app.config(function($stateProvider, $urlRouterProvider, $authProvider) {
  $authProvider.github({
    clientId: '17c72cd9aaac64f04f8b'
  });
  $authProvider.facebook({
      clientId: '247001215657126',
      name: 'facebook',
      url: '/auth/facebook',
      redirectUri: window.location.origin + '/',
    });
    // $authProvider.twitter({
    //     clientId: 'Uj70rKBvMobCl0rfsrALWgSnC'
    // });

    $authProvider.google({
      clientId: '31819506896-51dbsdcfunp9bnhb0h3cn83nbqcnije6.apps.googleusercontent.com',
      url: '/auth/google',
      redirectUri: window.location.origin

    });

  $stateProvider
    .state('home', { url: '/', templateUrl: '/html/home.html', controller: 'homeCtrl' })
    .state('register', {
      url: '/register',
      templateUrl: '/html/authForm.html',
      controller: 'authFormCtrl'
    })
    .state('login', {
      url: '/login',
      templateUrl: '/html/authForm.html',
      controller: 'authFormCtrl'
    })
    .state('profile', {
      url: '/profile',
      templateUrl: '/html/profile.html',
      controller: 'profileCtrl',
      resolve: {
        profile: function(Auth, $q, $state) {
          return Auth.getProfile()
          .catch(() => {
            $state.go('home');
            return $q.reject();
          });
        }
      }
    })

  $urlRouterProvider.otherwise('/');
});

app.filter('titlecase', function() {
  return function(input) {
    return input[0].toUpperCase() + input.slice(1).toLowerCase();
  };
});

// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('web', ['web.controllers', 'ui.router', 'ui.bootstrap'])

.filter('isEmpty', function () {
    var bar;
    return function (obj) {
        for (bar in obj) {
            if (obj.hasOwnProperty(bar)) {
                return false;
            }
        }
        return true;
    };
})

.value('fbURL', 'https://danceutils.firebaseio.com')
.service('fbRef', function(fbURL) {
  return new Firebase(fbURL);
})
.service('usersRef', function(fbRef) {
  return fbRef.child('users');
})
.service('eventRef', function(fbRef) {
  return fbRef.child('events');
})
.service('studentsRef', function(eventRef) {
  return eventRef.child('students');
})
.service('ratingsRef', function(eventRef) {
  return eventRef.child('ratings');
})

.factory('auth', function($firebaseAuth, fbRef) {
  return $firebaseAuth(fbRef);
})

.factory('genCode', function(n) {
  if (typeof n === "undefined") {
    n = 5;
  }

  var numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  var code = [];
  for (var i = 0; i < n; i++) {
    code.push(numbers[Math.floor(numbers.length*Math.random())]);
  }

  return code.join('');
})

.run(function($rootScope, $state) {
  $rootScope.$on("$stateChangeError", function(event, toState, toParams, fromState, fromParams, error) {
    // We can catch the error thrown when the $requireAuth promise is rejected
    // and redirect the user back to the home page
    if (error === "AUTH_REQUIRED") {
      $state.go("home");
    }
  });
})

.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider

  .state('home', {
    url: '/home',
    templateUrl: "templates/home.html",
    controller: 'HomeCtrl',
    resolve: {
        currentAuth: function(auth) {
          return auth.$waitForAuth();
        }
    }
  })

  .state('in', {
    url: "/events",
    templateUrl: "templates/events.html",
    controller: 'EventsCtrl',
    resolve: {
      currentAuth: function(auth) {
        return auth.$requireAuth();
      }
    }
  });

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/events');
});

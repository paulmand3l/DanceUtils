// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('mobile', ['ionic', 'mobile.controllers'])

.filter('toArray', function () {
  return function (obj, addKey) {
    if (!obj) return obj;
    if ( addKey === false ) {
      return Object.keys(obj).map(function(key) {
        return obj[key];
      });
    } else {
      return Object.keys(obj).map(function (key) {
        return Object.defineProperty(obj[key], '$key', { enumerable: false, value: key});
      });
    }
  };
})

.run(function($rootScope, $state) {
  $rootScope.$on("$stateChangeError", function(event, toState, toParams, fromState, fromParams, error) {
    // We can catch the error thrown when the $requireAuth promise is rejected
    // and redirect the user back to the home page
    if (error === "AUTH_REQUIRED") {
      $state.go("app.home");
    }
  });
})

.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider

  .state('app', {
    url: "/app",
    abstract: true,
    templateUrl: "templates/menu.html",
    controller: 'AppCtrl'
  })

  .state('app.event', {
    url: "/event",
    views: {
      'menuContent': {
        templateUrl: "templates/event.html",
        controller: "EventCtrl"
      }
    },
    resolve: {
      currentAuth: function(auth) {
        return auth.$waitForAuth();
      }
    }
  })

  .state('app.student', {
    url: "/event/:studentId",
    views: {
      'menuContent': {
        templateUrl: "templates/student.html",
        controller: 'StudentCtrl'
      }
    },
    resolve: {
      currentAuth: function(auth) {
        return auth.$requireAuth();
      }
    }
  })

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/app/event');
});

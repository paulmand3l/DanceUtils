angular.module('mobile.controllers', ["firebase"])

.value('fbURL', 'https://danceutils.firebaseio.com')
.service('fbRef', function(fbURL) {
  return new Firebase(fbURL);
})
.service('auth', function(fbRef, $firebaseAuth) {
  return $firebaseAuth(fbRef);
})
.service('eventsRef', function(fbRef) {
  return fbRef.child('events');
})
.service('usersRef', function(fbRef) {
  return fbRef.child('users');
})

.service('myEvents', function() {
  var getEvents = this.get = function() {
    return JSON.parse(localStorage['events'] || "{}");
  };

  var mutate = function(modifier) {
    var myEvents = getEvents();
    myEvents = modifier(myEvents);
    localStorage['events'] = JSON.stringify(myEvents);
  }

  this.add = function(key, data) {
    mutate(function(myEvents) {
      myEvents[key] = data;
      return myEvents;
    });
  };

  this.remove = function(key) {
    mutate(function(myEvents) {
      delete myEvents[key];
      return myEvents;
    });
  };
})

.factory('eventRefFromUID', function($q, usersRef, eventsRef) {
  return function(uid) {
    return $q(function(resolve, reject) {
      usersRef.child(uid).child('event').once('value', function(snap) {
        var eventKey = snap.val();
        resolve(eventsRef.child(eventKey));
      });
    });
  }
})

.factory('credsFromCode', function() {
  return function(code) {
    return {
      email: code + "@danceutils.com",
      password: code
    };
  };
})

.factory('addEventModal', function($rootScope, $ionicModal, $location, auth, usersRef, credsFromCode, eventRefFromUID, myEvents) {
  modalPromise = $ionicModal.fromTemplateUrl('templates/add-event.html', {
    focusFirstInput: true
  });

  modalPromise.then(function(modal) {
    modal.scope.e = {accessCode: ''};

    modal.scope.enter = function() {
      var code = modal.scope.e.accessCode;
      modal.scope.e.accessCode = '';

      auth.$unauth();
      auth.$authWithPassword(credsFromCode(code)).then(function(authData) {
        modal.hide();
        eventRefFromUID(authData.uid).then(function(eventRef) {
          eventRef.once('value', function(snap) {
            var eventData = snap.val();
            myEvents.add(snap.key(), {
              name: eventData.name,
              code: code
            });
            $rootScope.$broadcast('events.added');
            $location.path('/app/event');
          });
        });
      }).catch(function(error) {
        console.log(error);
      });
    };

    modal.scope.hide = function() {
      modal.hide();
    };
  });

  return modalPromise;
})

.controller('AppCtrl', function($scope, $rootScope, $location, $ionicSideMenuDelegate, $ionicLoading, auth, credsFromCode, addEventModal, myEvents) {
  $scope.events = myEvents.get();
  $rootScope.$on('events.added', function() {
    $scope.events = myEvents.get();
    console.log($scope.events);
  });

  $scope.addEvent = function() {
    addEventModal.then(function(modal) {
      modal.show();
      $ionicSideMenuDelegate.toggleLeft(false);
    });
  };

  $scope.switchEvents = function(eventCode) {
    $ionicLoading.show();
    auth.$unauth();
    auth.$authWithPassword(credsFromCode(eventCode)).then(function(authData) {
      $ionicSideMenuDelegate.toggleLeft(false);
      $location.path('/app/event');
    });
  };
})

.controller('HomeCtrl', function($scope, $location, currentAuth, addEventModal) {
  if (!currentAuth) {
    addEventModal.then(function(modal) {
      modal.show();
    });
  } else {
    $location.path('/app/event');
  }
})

.controller('EventCtrl', function($scope, $firebaseObject, $ionicLoading, auth, eventRefFromUID) {
  var unbinder = undefined;

  auth.$onAuth(function(currentAuth) {
    if (!currentAuth) return;

    if (unbinder) unbinder();

    eventRefFromUID(currentAuth.uid).then(function(eventRef) {
      $firebaseObject(eventRef).$bindTo($scope, 'event').then(function(unbind) {
        $ionicLoading.hide();
        unbinder = unbind;
      })
    });
  })
})

.controller('StudentCtrl', function($scope, $stateParams, $location, $firebaseObject, $firebaseArray, currentAuth, eventRefFromUID) {
  if (!$stateParams.studentId) {
    $location.path('/app/event');
  }

  eventRefFromUID(currentAuth.uid).then(function(eventRef) {
    $scope.levels = $firebaseObject(eventRef.child('levels'));

    var studentRef = eventRef.child('students').child($stateParams.studentId);
    $scope.student = $firebaseObject(studentRef);
    $scope.studentLevels = $firebaseArray(studentRef.child('levels'));
  });

  $scope.addLevel = function(level) {
    console.log(level, $scope.student, $scope.student.levels);

    if (!$scope.student.levels) {
      $scope.student.levels = [];
    }

    $scope.studentLevels.$add(level);
  };

  $scope.removeLevel = function(levelRef) {
    console.log(levelRef);
    $scope.studentLevels.$remove(levelRef);
  };
});

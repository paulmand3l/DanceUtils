angular.module('starter.controllers', ["firebase"])

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
  var mutate = function(modifier) {
    var myEvents = JSON.parse(localStorage['events']);
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

.factory('addEventModal', function($ionicModal, auth, usersRef, eventRefFromUID, myEvents) {
  modalPromise = $ionicModal.fromTemplateUrl('templates/add-event.html', {
    focusFirstInput: true
  });

  modalPromise.then(function(modal) {
    modal.scope.e = {accessCode: ''};

    modal.scope.enter = function() {
      var code = modal.scope.e.accessCode;
      auth.$authWithPassword({
        email: code + "@danceutils.com",
        password: code
      }).then(function(authData) {
        modal.hide();
        eventRefFromUID(authData.uid).then(function(eventRef) {
          eventRef.once('value', function(snap) {
            var eventData = snap.val();
            myEvents.add(eventKey, {
              name: eventData.name,
              code: code
            });
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

.controller('AppCtrl', function($scope, $rootScope, $firebaseObject, auth, addEventModal, usersRef, eventRefFromUID) {
  var unbinder = undefined;

  auth.$onAuth(function(authData) {
    if (!authData) {
      if (unbinder) {
        unbinder();
        unbinder = undefined;
      }

      addEventModal.then(function(modal) {
        modal.show();
      });
    } else {
      eventRefFromUID(authData.uid).then(function(eventRef) {
        $firebaseObject(eventRef).$bindTo($rootScope, 'event').then(function(unbind) {
          unbinder = unbind;
        });
      });
    }
  });
})

.controller('EventCtrl', function($scope, $rootScope) {
})

.controller('StudentRatingCtrl', function($scope, $rootScope, $stateParams, $firebaseObject, $firebaseArray) {
  $scope.student = $rootScope.event.students[$stateParams[studentId]];
  if (!$scope.student.ratings) {
    $scope.student.ratings = [];
  }

  $scope.addRating = function(rating) {
    $scope.student.ratings.push(rating);
    $rootScope.event.$save();
  }
});

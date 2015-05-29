angular.module('web.controllers', ["firebase"])

.controller('HomeCtrl', function($scope, $rootScope, $location, auth, currentAuth, usersRef) {
  if (currentAuth) {
    $location.path('/events');
  }

  $rootScope.authData = currentAuth;
  $scope.error = null;

  $scope.login = function(provider) {

    auth.$authWithOAuthPopup(provider, {
      scope: 'email'
    }).then(function(authData) {
      $rootScope.authData = authData;

      var userData = {}
      userData[authData.uid] = {
        email: authData.google.email,
        displayName: authData.google.displayName
      };

      usersRef.update(userData);

      $location.path('/events');
    }).catch(function(error) {
      $scope.error = error;
    });
  }

})

.controller('EventsCtrl', function($scope, $rootScope, $location, $modal, $firebaseObject, $q, auth, currentAuth, usersRef, eventRef) {
  $rootScope.authData = currentAuth;

  $scope.events = {}
  var userEventRef = usersRef.child(currentAuth.uid).child('events');

  userEventRef.on('child_added', function(snap) {
    $scope.events[snap.key()] = $firebaseObject(eventRef.child(snap.key()));
  });

  userEventRef.on('child_removed', function(snap) {
    console.log('deleting', snap.key());
    delete $scope.events[snap.key()];
  });

  $scope.createEvent = function() {
    $scope.editEvent();
  }

  $scope.editEvent = function(eventKey) {
    var modalInstance = $modal.open({
      templateUrl: 'templates/edit-event.html',
      controller: 'EditEventCtrl',
      resolve: {
        newEvent: function() { return typeof eventKey === 'undefined'; },
        e: function() {
          return !eventKey ? undefined : $q(function(resolve, reject) {
            eventRef.child(eventKey).once("value", function(snap) {
              resolve(snap.val());
            }, function(err) {
              reject(err);
            });
          });
        }
      }
    });

    modalInstance.result.then(function(e) {
      e.owner = currentAuth.uid;

      if (typeof eventKey === 'undefined') {
        eventKey = eventRef.push(e).key();
      } else {
        eventRef.child(eventKey).update(e);
      }

      var eventData = {}
      eventData[eventKey] = e.name;

      usersRef.child(currentAuth.uid).child('events').update(eventData);
    });
  }

  $scope.removeEvent = function(eventKey) {
    var confirmation = confirm("Are you sure you want to delete this event?\n\nThis action cannot be undone.");
    if (!confirmation) {
      return;
    }

    console.log('removing', eventKey);
    eventRef.child(eventKey).remove();
    userEventRef.child(eventKey).remove();
  }

  $scope.logout = function() {
    auth.$unauth();
    $location.path('/home');
  }
})

.controller('EditEventCtrl', function($scope, $rootScope, $modalInstance, e, newEvent) {
  $scope.e = e || {};

  $scope.newEvent = newEvent

  $scope.save = function() {
    if (!$scope.name.$valid) {
      $scope.nameInvalid = true;
      return;
    };

    $scope.e.students = ($scope.e.students || []).map(function(name) {
      return name.trim().replace(/\s+/, ' ');
    }).filter(function(name) {
      return name.length != 0;
    });

    $modalInstance.close($scope.e);
  }

  $scope.cancel = function() {
    $modalInstance.dismiss('cancel');
  }
});

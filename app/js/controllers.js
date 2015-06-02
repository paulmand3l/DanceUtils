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

      usersRef.child(authData.uid).update({
        email: authData.google.email,
        displayName: authData.google.displayName
      });

      $location.path('/events');
    }).catch(function(error) {
      $scope.error = error;
    });
  }

})

.factory('createAccessAccount', function($rootScope, usersRef, eventRef, auth) {
  return function(uid, eventKey, accessCode) {
    auth.$createUser({
      email: accessCode + "@danceutils.com",
      password: accessCode
    }).then(function(userData) {
      eventRef.child(eventKey).update({
        accessAccount: userData.uid
      });

      usersRef.child(userData.uid).update({
        event: eventKey,
        owner: uid
      });
    });
  }
})

.controller('EventsCtrl', function($scope, $rootScope, $location, $modal, $firebaseObject, $q, auth, currentAuth, fbRef, usersRef, eventRef, codeGen, createAccessAccount) {
  $rootScope.authData = currentAuth;

  $scope.events = {}
  var userEventRef = usersRef.child(currentAuth.uid).child('events');

  $scope.sizeOf = function(obj) {
    if (!obj) return 0;
    return Object.keys(obj).length;
  }

  userEventRef.on('child_added', function(snap) {
    $scope.events[snap.key()] = $firebaseObject(eventRef.child(snap.key()));
  });

  userEventRef.on('child_removed', function(snap) {
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
          return !eventKey ? {} : $q(function(resolve, reject) {
            eventRef.child(eventKey).once("value", function(snap) {
              var eventData = snap.val();

              var students = [];
              for (key in eventData.students) {
                students.push(eventData.students[key].name);
              }
              students.sort(function(a, b) { return a.toLowerCase() > b.toLowerCase() ? 1 : -1; });
              eventData.students = students;

              resolve(eventData);
            }, function(err) {
              reject(err);
            });
          });
        }
      }
    });

    modalInstance.result.then(function(e) {
      e.owner = currentAuth.uid;

      var studentNames = e.students.slice();
      delete e.students;

      if (!eventKey) {
        e.accessCode = codeGen();
        eventKey = eventRef.push(e).key();
        createAccessAccount(e.owner, eventKey, e.accessCode);
      }

      eventRef.child(eventKey).update(e);

      userEventRef.child(eventKey).set(e.name);

      eventRef.child(eventKey).child('students').transaction(function(oldStudents) {
        var students = {};
        for (var i = 0; i < studentNames.length; i++) {
          var safeName = btoa(studentNames[i]).replace(/\//g, '-');
          students[safeName] = angular.extend(((oldStudents && oldStudents[safeName]) || {}), {
            name: studentNames[i]
          });
        }
        return students;
      });
    });
  };

  $scope.removeEvent = function(eventKey) {
    var confirmation = confirm("Are you sure you want to delete this event?\n\nThis action cannot be undone.");
    if (!confirmation) {
      return;
    }

    eventRef.child(eventKey).once('value', function(snap) {
      usersRef.child(snap.val().accessAccount).remove();
    });
    eventRef.child(eventKey).remove(function() {
      console.log('removing', eventKey, 'from usereventref');
      userEventRef.child(eventKey).remove();
    });
  };

  $scope.logout = function() {
    auth.$unauth();
    $location.path('/home');
  }
})

.controller('EditEventCtrl', function($scope, $rootScope, $modalInstance, e, newEvent) {
  $scope.e = e;
  $scope.newEvent = newEvent

  $scope.save = function() {
    if (!$scope.name.$valid) {
      $scope.nameInvalid = true;
      return;
    };

    $scope.e.students = $scope.e.students.map(function(name) {
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

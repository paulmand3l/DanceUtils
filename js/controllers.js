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

.factory('credsFromCode', function() {
  return function(accessCode) {
    return {
      email: accessCode + "@danceutils.com",
      password: accessCode
    };
  };
})

.factory('createAccessAccount', function($rootScope, usersRef, eventRef, auth, credsFromCode) {
  return function(uid, eventKey, accessCode) {
    auth.$createUser(credsFromCode(accessCode)).then(function(userData) {
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

.controller('EventsCtrl', function($scope, $rootScope, $location, $modal, $firebaseObject, $q, auth, currentAuth, fbRef, usersRef, eventRef, codeGen, createAccessAccount, credsFromCode) {
  $rootScope.authData = currentAuth;

  function resolveLevels(levels) {
    return Object.keys(levels).map(function(key) {
      if (!isNaN(Number(levels[key]))) {
        return Number(levels[key]);
      } else {
        return levels[key];
      }
    });
  }

  $scope.evalFn = function(fnStr, arg) {
    var levelFn = eval('('+fnStr+')');
    return levelFn(resolveLevels(arg || {}));
  };

  $scope.studentsInLevel = function(level, students, fnStr) {
    if (!fnStr) return;

    var levelFn = eval('('+fnStr+')');
    var count = 0;
    for (key in students) {
      var studentLevel = levelFn(resolveLevels(students[key].levels || {}));

      if (typeof studentLevel === "number") {
        console.log(studentLevel);
        studentLevel = Math.round(studentLevel).toString();
      }

      if (level === studentLevel || (typeof level === "boolean" && level === !!studentLevel)) {
        count++;
      }
    }
    return count;
  };


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
      auth.$removeUser(credsFromCode(snap.val().accessCode));
    });

    eventRef.child(eventKey).remove(function() {
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
  $scope.newEvent = newEvent;

  $scope.toggleAdvanced = function() {
    if (typeof $scope.showAdvanced === "undefined") {
      $scope.editor = ace.edit("editor");
      $scope.editor.getSession().setMode("ace/mode/javascript");
      if (e.validLevels) {
        $scope.editor.setValue(e.validLevels);
      }
      $scope.editorStart = $scope.editor.getValue();
    }

    $scope.showAdvanced = !$scope.showAdvanced;
  }

  $scope.save = function() {
    if (!$scope.name.$valid) {
      $scope.nameInvalid = true;
      return;
    };

    if ($scope.showAdvanced && $scope.editorStart !== $scope.editor.getValue()) {
      $scope.e.validLevels = $scope.editor.getValue();
    }

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

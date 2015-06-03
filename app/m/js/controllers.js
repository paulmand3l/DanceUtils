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
  var getEvents = this.get = function(key) {
    var myEvents = JSON.parse(localStorage['events'] || "{}");

    for (key in myEvents) {
      if (!myEvents[key].key) {
        myEvents.key = key
      }
    }

    if (key) {
      return myEvents[key];
    } else {
      return myEvents;
    }
  };

  this.first = function() {
    return getEvents(Object.keys(getEvents())[0]);
  }

  var mutate = function(modifier) {
    var myEvents = getEvents();
    myEvents = modifier(myEvents);
    localStorage['events'] = JSON.stringify(myEvents);
  }

  this.add = function(key, data) {
    mutate(function(myEvents) {
      data.key = key;
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

  this.sizeOf = function() {
    return Object.keys(getEvents()).length;
  }
})

.factory('eventRefFromUID', function($q, usersRef, eventsRef) {
  return function(uid) {
    return $q(function(resolve, reject) {
      usersRef.child(uid).child('event').once('value', function(snap) {
        var eventKey = snap.val();
        if (eventKey) {
          resolve(eventsRef.child(eventKey));
        } else {
          reject("No such event.");
        }
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

      console.log('Attempting to add:', code, credsFromCode(code));

      auth.$authWithPassword(credsFromCode(code)).then(function(authData) {
        console.log('...Access granted.', authData);

        modal.hide();
        eventRefFromUID(authData.uid).then(function(eventRef) {
          eventRef.once('value', function(snap) {
            var eventData = snap.val();
            console.log('Adding', eventData.name, 'to my events.');
            myEvents.add(snap.key(), {
              name: eventData.name,
              code: code
            });
            $rootScope.$broadcast('events.added');
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
  });

  $scope.addEvent = function() {
    addEventModal.then(function(modal) {
      modal.show();
      $ionicSideMenuDelegate.toggleLeft(false);
    });
  };

  $scope.switchEvents = function(eventCode) {
    $ionicLoading.show();
    auth.$authWithPassword(credsFromCode(eventCode)).then(function(authData) {
      $ionicSideMenuDelegate.toggleLeft(false);
      $location.path('/app/event');
    });
  };
})

.controller('EventCtrl', function($scope, $ionicSideMenuDelegate, $ionicLoading, $firebaseObject, currentAuth, myEvents, credsFromCode, auth, eventRefFromUID, addEventModal) {
  $scope.evalFn = function(fnStr, arg) {
    if (arg) {
      return eval('('+fnStr+')')(Object.keys(arg).map(function(key) { return arg[key]; }));
    }
  };

  function unlockUI() {
    if ($ionicSideMenuDelegate.isOpen()) {
      $ionicSideMenuDelegate.toggleLeft();
    }
    $ionicLoading.hide();
  }

  function loadFirstEvent() {
    var firstEvent = myEvents.first();
    var code = firstEvent.code;

    auth.$authWithPassword(credsFromCode(code)).catch(function(reason) {
      console.log("Couldn't load first event.", firstEvent.name, reason);
      myEvents.remove(firstEvent.key);
      handleUnauth();
    });
  }

  var unbinder = undefined;
  function handleAuth(currentAuth) {
    eventRefFromUID(currentAuth.uid).then(function(eventRef) {
      $firebaseObject(eventRef).$bindTo($scope, 'event').then(function(unbind) {
        unbinder = unbind;
        unlockUI();
      });
    }, function(reason) {
      console.log(reason);
      auth.$unauth();
    });
  }

  function handleUnauth() {
    if (unbinder) {
      unbinder();
      unbinder = undefined;
    }

    if (myEvents.sizeOf() > 0) {
      loadFirstEvent();
    } else {
      addEventModal.then(function(modal) {
        unlockUI();
        modal.show();
      });
    }
  }

  function main(currentAuth) {
    $ionicLoading.show();
    if (currentAuth) {
      handleAuth(currentAuth);
    } else {
      handleUnauth();
    }
  }

  main(currentAuth);

  auth.$onAuth(main);
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
    if (!$scope.student.levels) {
      $scope.student.levels = [];
    }

    $scope.studentLevels.$add(level);
  };

  $scope.removeLevel = function(levelRef) {
    $scope.studentLevels.$remove(levelRef);
  };
});

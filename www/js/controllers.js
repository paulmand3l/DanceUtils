angular.module('starter.controllers', ["firebase"])

.controller('AppCtrl', function($scope, $ionicModal, $timeout) {
})

.value('fbURL', 'https://danceutils.firebaseio.com')
.service('fbRef', function(fbURL) {
  return new Firebase(fbURL);
})
.service('eventRef', function(fbRef) {
  return fbRef.child('events').child('myEvent');
})
.service('studentsRef', function(eventRef) {
  return eventRef.child('students');
})
.service('ratingsRef', function(eventRef) {
  return eventRef.child('ratings');
})

.controller('EventCtrl', function($scope, $ionicModal, $firebaseObject, $firebaseArray, eventRef, studentsRef) {
  $firebaseObject(eventRef).$bindTo($scope, 'event');

  $ionicModal.fromTemplateUrl('templates/edit-students.html', {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function(modal) {
    $scope.modal = modal;
  });

  $scope.showModal = function() {
    $scope.modal.show();
  }

  $scope.hideModal = function() {
    $scope.modal.hide();
  }

  studentsRef.on("value", function(snap) {
    var students = snap.val();
    var nameList = [];
    for (key in students) {
      nameList.push(students[key].name)
    }
    $scope.students = {
      list: nameList,
      count: nameList.length
    };
  });

  $scope.save = function() {
    var names = $scope.students.list.map(function(name) {
      return name.trim().replace(/\s+/, ' ');
    });

    studentsRef.set({});
    for (var i = 0; i < names.length; i++) {
      studentsRef.push({
        name: names[i],
      });
    }

    $scope.hideModal();
  };
})

.controller('StudentListCtrl', function($scope, $firebaseArray, studentsRef) {
  $scope.students = $firebaseArray(studentsRef);
})

.controller('StudentRatingCtrl', function($scope, $stateParams, $firebaseObject, $firebaseArray, studentsRef, ratingsRef) {
  studentRef = studentsRef.child($stateParams.studentId);

  $scope.ratings = $firebaseObject(ratingsRef);
  $scope.student = $firebaseObject(studentRef);

  // console.log($scope.student);

  $scope.addRating = function(rating) {
    studentRef.child('ratings').push(rating);
  }
});

// Angular.js application for the admin page
angular.module('adminApp', [])
  .controller('AdminController', ['$scope', '$http', '$window', function($scope, $http, $window) {
    // Get user from localStorage
    const storedUser = $window.localStorage.getItem('user');
    $scope.user = storedUser ? JSON.parse(storedUser) : null;


    // Function to set active tab and handle navigation
    $scope.setActiveTab = function(tab) {
      $scope.activeTab = tab;
      
      // If on mobile, close the menu after selecting an item
      if (window.innerWidth <= 768) {
        $scope.mobileMenuOpen = false;
      }
      
      // Navigate to the appropriate page based on the tab
      switch(tab) {
        case 'user-book-manager':
          $window.location.href = '/user-book-manager';
          break;
        case 'messages':
          $window.location.href = '/messages';
          break;
        case 'report':
          $window.location.href = '/report';
          break;
        case 'account':
          $window.location.href = '/account';
          break;
        default:
          // Stay on dashboard for other tabs
          break;
      }
    };
    
    // Check if user is logged in and is admin
    if (!$scope.user) {
      $window.location.href = '/login';
      return;
    }
    
    // Initialize variables
    $scope.activeTab = 'user-book-manager';
    $scope.mobileMenuOpen = false;
    $scope.books = [];
    $scope.users = [];
    $scope.bookSearch = '';
    $scope.userSearch = '';
    
    // Modal controls
    $scope.showBookModal = false;
    $scope.showAddBook = false;
    $scope.showAddUser = false;
    $scope.showDeleteConfirm = false;
    $scope.selectedBook = {};
    $scope.newBook = {};
    $scope.newUser = {};
    $scope.deleteTarget = null;
    $scope.deleteType = '';
    $scope.deleteConfirmMessage = '';
    
    // Load initial data
    loadBooks();
    loadUsers();
    
    // Toggle mobile menu
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
    // Logout function
    $scope.logout = function() {
      $window.localStorage.removeItem('user');
      $window.location.href = '/login';
    };
    
    // Load books from API
    function loadBooks() {
      $http.get('/api/books/new-arrivals')
        .then(function(response) {
          if (response.data.success) {
            $scope.books = response.data.books;
          }
        })
        .catch(function(error) {
          console.error('Error loading books:', error);
          alert('Error loading books. Please try again later.');
        });
    }
    
    // Load users from API
    function loadUsers() {
      // Add userId parameter to the request
      $http.get('/api/admin/users', {
        params: { userId: $scope.user.id }
      })
        .then(function(response) {
          if (response.data.success) {
            $scope.users = response.data.users;
          }
        })
        .catch(function(error) {
          console.error('Error loading books:', error);
          alert('Error loading users. Please try again later.');
        });
    }
    
    // Book details modal
    $scope.showBookDetails = function(book) {
      $scope.selectedBook = book;
      $scope.showBookModal = true;
      
      // Get additional book details if needed
      $http.get('/api/books/' + book.id)
        .then(function(response) {
          if (response.data.success) {
            $scope.selectedBook = response.data.book;
          }
        })
        .catch(function(error) {
          console.error('Error loading book details:', error);
        });
    };
    
    $scope.closeBookModal = function() {
      $scope.showBookModal = false;
    };
    
    // Add book modal
    $scope.showAddBookModal = function() {
        $scope.newBook = {
        title: '',
        category: '',
        price: '',
        description: '',
        status: 'Available',
        sellerId: '',
        coverImage: null,
        bookFile: null
        };
        $scope.showAddBook = true;
    };
    
    $scope.closeAddBookModal = function() {
        $scope.showAddBook = false;
    };
    
    // Add user modal
    $scope.showAddUserModal = function() {
        $scope.newUser = {
        username: '',
        email: '',
        role: 'public',
        password: ''
        };
        $scope.showAddUser = true;
    };
    
    $scope.closeAddUserModal = function() {
        $scope.showAddUser = false;
    };
    
    // Delete confirmation modal
    $scope.confirmDeleteBook = function(book) {
        $scope.deleteTarget = book;
        $scope.deleteType = 'book';
        $scope.deleteConfirmMessage = `Are you sure you want to delete the book "${book.title}"?`;
        $scope.showDeleteConfirm = true;
    };
    
    $scope.confirmDeleteUser = function(user) {
        $scope.deleteTarget = user;
        $scope.deleteType = 'user';
        $scope.deleteConfirmMessage = `Are you sure you want to delete the user "${user.username}"?`;
        $scope.showDeleteConfirm = true;
    };
    
    $scope.closeDeleteConfirmModal = function() {
        $scope.showDeleteConfirm = false;
        $scope.deleteTarget = null;
        $scope.deleteType = '';
    };
    
    $scope.confirmDelete = function() {
        if ($scope.deleteType === 'book') {
        deleteBook($scope.deleteTarget);
        } else if ($scope.deleteType === 'user') {
        deleteUser($scope.deleteTarget);
        }
        $scope.closeDeleteConfirmModal();
    };
    
    // Delete book
    function deleteBook(book) {
        $http.delete(`/api/books/${book.id}?sellerId=${$scope.user.id}`)
        .then(function(response) {
            if (response.data.success) {
            // Remove book from array
            const index = $scope.books.findIndex(b => b.id === book.id);
            if (index !== -1) {
                $scope.books.splice(index, 1);
            }
            alert('Book deleted successfully');
            }
        })
        .catch(function(error) {
            console.error('Error deleting book:', error);
            alert('Error deleting book. Please try again later.');
        });
    }
    
    // Delete user
    function deleteUser(user) {
        // This endpoint would need to be implemented on the server side
        $http.delete(`/api/admin/users/${user.id}?adminId=${$scope.user.id}`)
        .then(function(response) {
            if (response.data.success) {
            // Remove user from array
            const index = $scope.users.findIndex(u => u.id === user.id);
            if (index !== -1) {
                $scope.users.splice(index, 1);
            }
            alert('User deleted successfully');
            }
        })
        .catch(function(error) {
            console.error('Error deleting user:', error);
            alert('Error deleting user. Please try again later.');
        });
    }
    
    // Add book
    $scope.addBook = function() {
      // Create form data
      const formData = new FormData();
      formData.append('title', $scope.newBook.title);
      formData.append('category', $scope.newBook.category);
      formData.append('price', $scope.newBook.price);
      formData.append('description', $scope.newBook.description);
      formData.append('status', $scope.newBook.status);
      // Use the current user's ID as the seller
      formData.append('sellerId', $scope.user.id);
      formData.append('coverImage', $scope.newBook.coverImage);
      formData.append('bookFile', $scope.newBook.bookFile);
      
      $http({
      method: 'POST',
      url: '/api/books/add',
      data: formData,
      headers: {
          'Content-Type': undefined // Let browser set content type with boundary
      },
      transformRequest: angular.identity
      }).then(function(response) {
      if (response.data.success) {
          alert('Book added successfully');
          loadBooks(); // Reload books
          $scope.closeAddBookModal();
      }
      }).catch(function(error) {
      console.error('Error adding book:', error);
      alert('Error adding book. Please try again later.');
      });
    };
    
    // Add user
    $scope.addUser = function() {
        // This endpoint would need to be implemented on the server side
        $http.post('/api/admin/users/add', {
        username: $scope.newUser.username,
        email: $scope.newUser.email,
        role: $scope.newUser.role,
        password: $scope.newUser.password,
        adminId: $scope.user.id
        }).then(function(response) {
        if (response.data.success) {
            alert('User added successfully');
            loadUsers(); // Reload users
            $scope.closeAddUserModal();
        }
        }).catch(function(error) {
        console.error('Error adding user:', error);
        alert('Error adding user. Please try again later.');
        });
    };
    }])
    // File upload directive for Angular.js
    .directive('fileModel', ['$parse', function($parse) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
        const model = $parse(attrs.fileModel);
        const modelSetter = model.assign;
        
        element.bind('change', function() {
            scope.$apply(function() {
            modelSetter(scope, element[0].files[0]);
            });
        });
        }
    };
    }]);
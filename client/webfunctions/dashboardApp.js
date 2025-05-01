// Angular.js application for the dashboard page
angular.module('dashboardApp', [])
  .controller('DashboardController', ['$scope', '$http', '$window', function($scope, $http, $window) {
    // Get user information from localStorage
    try {
      $scope.user = JSON.parse($window.localStorage.getItem('user'));
      
      // Redirect to login if user not found
      if (!$scope.user) {
        $window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error getting user data:', error);
      $window.location.href = '/login';
    }
    
    // Mobile menu state
    $scope.mobileMenuOpen = false;
    
    // Toggle mobile menu
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
    // Close mobile menu when clicking a menu item (on mobile)
    $scope.setActiveTab = function(tab) {
      $scope.activeTab = tab;
      
      // If on mobile (screen width <= 768px), close the menu
      if (window.innerWidth <= 768) {
        $scope.mobileMenuOpen = false;
      }
    };
    
    // Initialize active tab (default: dashboard)
    $scope.activeTab = 'dashboard';
    
    // Search functionality
    $scope.searchQuery = '';
    $scope.searchFilter = {
      category: '',
      sortBy: 'relevance'
    };
    
    $scope.searchBooks = function() {
      console.log('Searching for:', $scope.searchQuery);
      console.log('Filters:', $scope.searchFilter);
      
      // In a real app, this would send a request to the server
      // For now, we'll just log the search parameters
      
      // Close mobile menu when searching (if on mobile)
      if (window.innerWidth <= 768) {
        $scope.mobileMenuOpen = false;
      }
    };
    
    // Sample data for new arrivals
    $scope.newArrivals = [
      {
        id: 1,
        title: 'The Art of Programming',
        author: 'John Smith',
        coverUrl: '../webstyles/img/placeholder.jpg',
        price: 29.99,
        rating: 4.5,
        inWishlist: false
      },
      {
        id: 2,
        title: 'Data Structures and Algorithms',
        author: 'Jane Doe',
        coverUrl: '../webstyles/img/placeholder.jpg',
        price: 34.99,
        rating: 4.7,
        inWishlist: true
      },
      {
        id: 3,
        title: 'Machine Learning Fundamentals',
        author: 'Robert Johnson',
        coverUrl: '../webstyles/img/placeholder.jpg',
        price: 39.99,
        rating: 4.8,
        inWishlist: false
      },
      {
        id: 4,
        title: 'Web Development Mastery',
        author: 'Sarah Williams',
        coverUrl: '../webstyles/img/placeholder.jpg',
        price: 27.99,
        rating: 4.3,
        inWishlist: false
      }
    ];
    
    // Sample data for wishlist
    $scope.wishlistBooks = [
      {
        id: 2,
        title: 'Data Structures and Algorithms',
        author: 'Jane Doe',
        coverUrl: '../webstyles/img/placeholder.jpg',
        price: 34.99,
        rating: 4.7
      },
      {
        id: 5,
        title: 'Artificial Intelligence in Practice',
        author: 'Michael Brown',
        coverUrl: '../webstyles/img/placeholder.jpg',
        price: 42.99,
        rating: 4.6
      }
    ];
    
    // Function to add book to cart
    $scope.addToCart = function(book) {
      console.log('Adding to cart:', book.title);
      
      // In a real app, this would add the book to the cart
      // For now, we'll just show a notification
      
      // Create a temporary notification
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.innerHTML = `<i class="fas fa-check-circle"></i> Added "${book.title}" to cart`;
      document.body.appendChild(notification);
      
      // Show notification
      setTimeout(function() {
        notification.classList.add('show');
      }, 100);
      
      // Remove notification after 3 seconds
      setTimeout(function() {
        notification.classList.remove('show');
        setTimeout(function() {
          document.body.removeChild(notification);
        }, 300);
      }, 3000);
    };
    
    // Function to toggle book in wishlist
    $scope.toggleWishlist = function(book) {
      console.log('Toggling wishlist status for:', book.title);
      
      // Toggle wishlist status
      book.inWishlist = !book.inWishlist;
      
      // Show notification message
      const message = book.inWishlist ? 
        `Added "${book.title}" to wishlist` : 
        `Removed "${book.title}" from wishlist`;
      
      // Create a temporary notification
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.innerHTML = `<i class="fas ${book.inWishlist ? 'fa-heart' : 'fa-heart-broken'}"></i> ${message}`;
      document.body.appendChild(notification);
      
      // Show notification
      setTimeout(function() {
        notification.classList.add('show');
      }, 100);
      
      // Remove notification after 3 seconds
      setTimeout(function() {
        notification.classList.remove('show');
        setTimeout(function() {
          document.body.removeChild(notification);
        }, 300);
      }, 3000);
      
      // In a real app, this would update the wishlist on the server
      // For now, we'll just update the UI
      if (book.inWishlist) {
        // Add to wishlist
        $scope.wishlistBooks.push(Object.assign({}, book));
      } else {
        // Remove from wishlist
        $scope.removeFromWishlist(book);
      }
      
      // Apply scope changes
      if(!$scope.$$phase) {
        $scope.$apply();
      }
    };
    
    // Function to remove book from wishlist
    $scope.removeFromWishlist = function(book) {
      console.log('Removing from wishlist:', book.title);
      
      // Find book in new arrivals and update its status
      $scope.newArrivals.forEach(function(newBook) {
        if (newBook.id === book.id) {
          newBook.inWishlist = false;
        }
      });
      
      // Remove from wishlist
      $scope.wishlistBooks = $scope.wishlistBooks.filter(function(wishlistBook) {
        return wishlistBook.id !== book.id;
      });
      
      // Apply scope changes
      if(!$scope.$$phase) {
        $scope.$apply();
      }
    };
    
    // Logout function
    $scope.logout = function() {
      // Ask for confirmation
      if (confirm('Are you sure you want to logout?')) {
        // Clear user data from localStorage
        $window.localStorage.removeItem('user');
        
        // Redirect to login page
        $window.location.href = '/login';
      }
    };
    
    // Handle window resize to manage mobile menu
    angular.element($window).bind('resize', function() {
      // If window is resized to desktop size, close mobile menu
      if (window.innerWidth > 768 && $scope.mobileMenuOpen) {
        $scope.mobileMenuOpen = false;
        if(!$scope.$$phase) {
          $scope.$apply();
        }
      }
    });
  }]);
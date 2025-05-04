angular.module('placeOrderApp', [])
  .controller('PlaceOrderController', ['$scope', '$http', '$window', '$location', function($scope, $http, $window, $location) {
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
    
    // Get book ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('bookId');
    
    if (!bookId) {
      console.error('No book ID provided');
      $window.location.href = '/dashboard';
      return;
    }
    
    // Initialize book data
    $scope.book = {};
    
    // Mobile menu state
    $scope.mobileMenuOpen = false;
    
    // Toggle mobile menu
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
    // Initialize Stripe elements
    let stripe = null;
    let elements = null;
    let paymentElement = null;
    
    // Check for testing mode from URL parameter
    const isTestingMode = new URLSearchParams(window.location.search).get('testing') === 'true';
    
    // Function to initialize Stripe
    function initStripe() {
      if (isTestingMode) {
        // For testing mode, just create a mock payment element
        const mockElement = document.createElement('div');
        mockElement.className = 'mock-payment-element';
        mockElement.innerHTML = `
          <div style="border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
            <h4 style="margin-top: 0;">Testing Mode - Mock Payment</h4>
            <p>This is a mock payment form for testing purposes.</p>
            <select id="mock-payment-method" style="margin-bottom: 10px; width: 100%; padding: 8px;">
              <option value="card">Credit Card</option>
              <option value="fpx">Online Banking (FPX)</option>
              <option value="grabpay">GrabPay</option>
              <option value="boostpay">Boost</option>
              <option value="duitnow_qr">DuitNow QR</option>
            </select>
            <p style="color: #666; font-size: 14px;">No real payment will be processed.</p>
          </div>
        `;
        document.getElementById('stripe-payment-element').appendChild(mockElement);
      } else {
        // Real Stripe initialization
        stripe = Stripe(stripePublishableKey);
        
        // Create payment element options with additional payment methods
        const options = {
          mode: 'payment',
          amount: Math.round($scope.book.price * 100), // Convert to cents
          currency: 'myr',
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#0066cc',
            },
          },
          // Enable more payment methods
          payment_method_types: [
            'card',
            'fpx',        // Online Banking in Malaysia
            'grabpay',    // GrabPay
            'promptpay',  // PromptPay for Thailand
            'paynow',     // PayNow for Singapore
          ]
        };
        
        // Create elements instance
        elements = stripe.elements(options);
        
        // Create and mount the Payment Element
        paymentElement = elements.create('payment');
        paymentElement.mount('#stripe-payment-element');
        
        // Handle real-time validation errors
        paymentElement.on('change', function(event) {
          const displayError = document.querySelector('.card-errors');
          if (event.error) {
            displayError.textContent = event.error.message;
          } else {
            displayError.textContent = '';
          }
        });
      }
    }
    
    // Initialize MAC address
    $scope.macAddress = '';
    
    // Initialize modal state
    $scope.showInstructionModal = false;
    $scope.instructionType = '';
    
    // Function to set active tab and handle navigation
    $scope.setActiveTab = function(tab) {
      // If on mobile, close the menu after selecting an item
      if (window.innerWidth <= 768) {
        $scope.mobileMenuOpen = false;
      }
      
      // Navigate to the appropriate page based on the tab
      switch(tab) {
        case 'add-ebook':
          $window.location.href = '/add-ebook';
          break;
        case 'order':
          $window.location.href = '/order';
          break;
        case 'messages':
          $window.location.href = '/messages';
          break;
        case 'mybook':
          $window.location.href = '/mybook';
          break;
        case 'account':
          $window.location.href = '/account';
          break;
        case 'dashboard':
          $window.location.href = '/dashboard';
          break;
        default:
          // Stay on current page for other tabs
          break;
      }
    };
  
    function loadBookDetails() {
      $http.get('/api/books/' + bookId)
        .then(function(response) {
          if (response.data.success) {
            $scope.book = response.data.book;
            
            if (isTestingMode) {
              // In testing mode, initialize mock payment UI
              initStripe();
              return Promise.resolve();
            } else {
              // Get Stripe publishable key from server instead of hardcoding it
              return $http.get('/api/stripe-config');
            }
          } else {
            console.error('Error loading book details:', response.data.message);
            showToast('Error loading book details', 'error');
            throw new Error('Failed to load book details');
          }
        })
        .then(function(response) {
          if (!isTestingMode && response) {
            // Initialize Stripe with the publishable key from the server
            stripe = Stripe(response.data.publishableKey);
            
            // Create payment element options with additional payment methods
            const options = {
              mode: 'payment',
              amount: Math.round($scope.book.price * 100), // Convert to cents
              currency: 'myr',
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#0066cc',
                },
              },
              // Enable more payment methods
              payment_method_types: [
                'card',
                'fpx',        // Online Banking in Malaysia
                'grabpay',    // GrabPay
              ]
            };
            
            // Create elements instance
            elements = stripe.elements(options);
            
            // Create and mount the Payment Element
            paymentElement = elements.create('payment');
            paymentElement.mount('#stripe-payment-element');
            
            // Handle real-time validation errors
            paymentElement.on('change', function(event) {
              const displayError = document.querySelector('.card-errors');
              if (event.error) {
                displayError.textContent = event.error.message;
              } else {
                displayError.textContent = '';
              }
            });
          }
        })
        .catch(function(error) {
          console.error('Error loading book details or initializing Stripe:', error);
          showToast('Server error. Please try again later.', 'error');
        });
    }

    // Function to show instructions modal
    $scope.showInstructions = function(type) {
      $scope.instructionType = type;
      $scope.showInstructionModal = true;
    };
    
    // Function to close instructions modal
    $scope.closeInstructions = function() {
      $scope.showInstructionModal = false;
    };
    
    // Function to create payment intent on the server
    function createPaymentIntent() {
      return $http.post('/api/create-payment-intent', {
        amount: Math.round($scope.book.price * 100),
        currency: 'myr'
      });
    }
    
    // Function to generate a random payment ID for testing
    function generateMockPaymentIntentId() {
      return 'pi_test_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Function to handle place order action
    $scope.placeOrder = function() {
      // Validate MAC address
      if (!$scope.macAddress) {
        showToast('Please enter your MAC address', 'error');
        return;
      }
      
      // Validate MAC address format (XX:XX:XX:XX:XX:XX)
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test($scope.macAddress)) {
        showToast('Please enter a valid MAC address format (XX:XX:XX:XX:XX:XX)', 'error');
        return;
      }
      
      if (isTestingMode) {
        // In testing mode, skip actual payment processing
        showToast('Processing test payment...', 'info');
        
        // Get selected mock payment method
        const mockPaymentMethod = document.getElementById('mock-payment-method').value;
        
        // Simulate a small delay for payment processing
        setTimeout(function() {
          const orderData = {
            bookId: parseInt(bookId),
            buyerId: $scope.user.id,
            paymentMethod: mockPaymentMethod,
            macAddress: $scope.macAddress,
            paymentIntentId: generateMockPaymentIntentId()
          };
          
          $http.post('/api/purchases/place-order', orderData)
            .then(function(response) {
              if (response && response.data.success) {
                showToast('Test order placed successfully! Order ID: ' + response.data.orderId, 'success');
                
                // Redirect to the orders page after a delay
                setTimeout(function() {
                  $window.location.href = '/order';
                }, 3000);
              } else if (response) {
                showToast('Error: ' + response.data.message, 'error');
              }
            })
            .catch(function(error) {
              console.error('Error placing test order:', error);
              showToast('Test order failed. Please try again.', 'error');
            });
        }, 1500);
        
      } else {
        // Real payment processing
        showToast('Processing payment...', 'info');
        
        // Create payment intent on server
        createPaymentIntent()
          .then(function(response) {
            if (!response.data.clientSecret) {
              throw new Error('No client secret returned');
            }
            
            // Confirm payment with Stripe
            return stripe.confirmPayment({
              elements,
              clientSecret: response.data.clientSecret,
              confirmParams: {
                return_url: window.location.origin + '/order-confirmation',
              },
              redirect: 'if_required'
            });
          })
          .then(function(result) {
            if (result.error) {
              // Show error to customer
              showToast(result.error.message, 'error');
              return;
            }
            
            // Payment successful, now place the order
            const orderData = {
              bookId: parseInt(bookId),
              buyerId: $scope.user.id,
              paymentMethod: 'stripe',
              macAddress: $scope.macAddress,
              paymentIntentId: result.paymentIntent.id
            };
            
            return $http.post('/api/purchases/place-order', orderData);
          })
          .then(function(response) {
            if (response && response.data.success) {
              showToast('Order placed successfully! Order ID: ' + response.data.orderId, 'success');
              
              // Redirect to the orders page after a delay
              setTimeout(function() {
                $window.location.href = '/order';
              }, 3000);
            } else if (response) {
              showToast('Error: ' + response.data.message, 'error');
            }
          })
          .catch(function(error) {
            console.error('Error processing payment or placing order:', error);
            showToast('Payment processing failed. Please try again.', 'error');
          });
      }
    };
    
    // Helper function to show toast notifications
    function showToast(message, type) {
      // Create toast element
      var toast = document.createElement('div');
      toast.className = 'toast-notification';
      
      // Set icon based on type
      var icon = '';
      if (type === 'success') {
        icon = '<i class="fas fa-check-circle"></i>';
      } else if (type === 'heart') {
        icon = '<i class="fas fa-heart"></i>';
      } else if (type === 'info') {
        icon = '<i class="fas fa-info-circle"></i>';
      } else if (type === 'error') {
        icon = '<i class="fas fa-exclamation-circle"></i>';
      }
      
      toast.innerHTML = icon + ' ' + message;
      document.body.appendChild(toast);
      
      // Show toast
      setTimeout(function() {
        toast.classList.add('show');
      }, 100);
      
      // Hide and remove toast
      setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() {
          document.body.removeChild(toast);
        }, 300);
      }, 3000);
    }
    
    // Logout function
    $scope.logout = function() {
      if (confirm('Are you sure you want to logout?')) {
        // Clear user data from localStorage
        $window.localStorage.removeItem('user');
        
        // Redirect to login page
        $window.location.href = '/login';
      }
    };
    
    // Load book details on page load
    loadBookDetails();
  }]);
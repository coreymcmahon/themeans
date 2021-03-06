'use strict';

/**
 * @ngdoc service
 * @name airplayPutioApp.localstorage
 * @description
 * # localstorage
 * Service in the airplayPutioApp.
 */
angular.module('tm.parse', [])
  .provider('Parse', function ParseProvider(){

    // $ionicPlatform injected as default to support backwards compatibility. Configure without to
    // exclude for angular-web projects
    var options = {
      applicationId: '',
      javaScriptKey: '',
      clientKey: '',
      deps: ['$q','$window', '$ionicPlatform']
    };

    var ngParse = function () {

      var $http           = arguments[0],
          $q              = arguments[1],
          $window         = arguments[2],
          $ionicPlatform  = arguments[3],
          parse           = $window.Parse;

      // Delete from the $window scope to ensure that we use the deps injection
      delete $window.Parse;

      parse.initialize(
        options.applicationId,
        options.javaScriptKey
      );

      // Switch the parse._ajax method to use angular $http
      parse._ajax = function (method, url, data, success, error) {

        var options = {
          success: success,
          error: error
        };

        if (parse._useXDomainRequest()) {
          return parse._ajaxIE8(method, url, data)._thenRunCallbacks(options);
        }

        var promise = new parse.Promise();
        var attempts = 0;

        function dispatch() {
          $http({
            method: method,
            url: url,
            headers: { 'Content-Type': 'text/plain' },
            data: data
          }).then(processResponse, processResponse);
        }

        function processResponse(xhr){
          xhr.responseText = angular.toJson(xhr.data);

          if (xhr.status >= 200 && xhr.status < 300) {
            if (xhr.data) {
              promise.resolve(xhr.data, xhr.status, xhr);
            }
          } else if (xhr.status >= 500) {
            // Retry on 5XX
            if (++attempts < 5) {
              // Exponentially-growing delay
              var delay = Math.round(Math.random() * 125 * Math.pow(2, attempts));
              setTimeout(function () {
                dispatch(attempts);
              }, delay);
            } else {
              // After 5 retries, fail
              promise.reject(xhr);
            }
          } else {
            promise.reject(xhr);
          }
        }

        dispatch();
        return promise._thenRunCallbacks(options);
      };

      parse.Object.prototype.getNgModel = function () {
        var key, child,
          ret = angular.fromJson(angular.toJson(this));
          // ret = angular.fromJson(this.toJSON());

        for (key in this.attributes)
        {
          child = this.get(key);

          if (child && typeof child.getNgModel === 'function')
          {
            ret[key] = child.getNgModel();
          }
          else if (Array.isArray(child))
          {
            ret[key] = [];
            for (var i = 0; i < child.length; i++)
            {
              if (typeof child[i].getNgModel === 'function')
              {
                ret[key].push(child[i].getNgModel());
              }
              else
              {
                ret[key].push(child[i]);
              }
            }
          }
          else
          {
            ret[key] = this.get(key);
          }
        }

        ret['className'] = this.className;
        return ret;
      };

      parse.Object.prototype.getNgFormModel = function () {
        // var ret = angular.fromJson(this.toJSON());
        var ret = angular.fromJson(angular.toJson(this));

        ret['className'] = this.className;
        return ret;
      };

      parse.Object.prototype.initialize = function (attrs, options) {

        // break if there are no options
        if(typeof options === 'undefined')
        {
          return this;
        }
        else if(typeof options.ngModel === 'undefined')
        {
          return this;
        }
        // else
        // {
        //   throw 'tmParse error, something has gone horribly wrong';
        //   debugger;
        // }

        var resetOpsQueue = true;
        if(typeof options.resetOpsQueue !== 'undefined')
        {
          resetOpsQueue = options.resetOpsQueue;
        }

        // amay0048: TODO - this should not use try/catch
        try
        {
          delete this.attributes.className;
        } catch(e){}

        attrs = angular.copy(attrs);

        try
        {
          delete attrs.className;
        } catch(e){}
        try
        {
          delete this._opSetQueue[0].className;
        } catch(e){}

        var key, type, Model, value, attributes, tmp;
        for (key in attrs)
        {
          if(Array.isArray(attrs[key]))
          {
            tmp = [];
            for(var i=0; i<attrs[key].length; i++)
            {
              attributes = attrs[key][i];

              if(attributes && attributes.className && typeof attributes.getNgModel !== 'function')
              {
                Model = parse.Object._classMap[type];
                value = new Model(attributes, {ngModel:true});
                tmp.push(value);
              }
              else
              {
                tmp.push(angular.copy(attributes));
              }
            }
            this.set(key,tmp);
          }
          else
          {
            attributes = attrs[key];

            if(attributes && attributes.className && typeof attributes.getNgModel !== 'function')
            {
              Model = parse.Object._classMap[attributes.className];
              value = new Model(attributes, {ngModel:true});
              this.attributes[key] = value;
            }
            else
            {
              this.attributes[key] = angular.copy(attrs[key]);
            }
          }
        }

        if(resetOpsQueue)
        {
          // debugger;
          this._opSetQueue = [{}];
        }
        return this;
      };

      parse.serialiseArrayForDisplay = function(parseObjectArray){
        var ret = [];
        for (var i=0; i < parseObjectArray.length; i++)
        {
          ret.push(parseObjectArray[i].getNgModel());
        }
        return ret;
      };

      if(!$ionicPlatform)
      {
        return parse;
      }

      // parse initialize device on $ionicPlatform ready.
      var deferred = $q.defer();

      $ionicPlatform.ready()
      .then(function success(){
        if($window.parsePlugin)
        {
          var bridge = $window.parsePlugin;
          // Delete from the $window scope to ensure that we use the deps injection
          delete $window.parsePlugin;
          bridge.initialize(
            options.applicationId, 
            options.clientKey, 
            function success() {
              deferred.resolve(bridge);
            },function err(ex) {
              deferred.reject(ex);
            });
        }
        else
        {
          deferred.reject('$window.parsePlugin is not defined');
        }
      }, function err(ex){
        deferred.reject(ex);
      });

      parse.nativeBridge = deferred.promise;
      return parse;
    };

    this.configure = function (configOptions) {

      angular.extend(options, configOptions);

      if(typeof configOptions.deps !== 'undefined')
      {
        // If the deps array has changed, we need to re-add
        // the ngParse function and re-define this.$get
        options.deps.unshift('$http');
        options.deps.push(ngParse);
        this.$get = options.deps;
      }
    };

    options.deps.unshift('$http');
    options.deps.push(ngParse);
    this.$get = options.deps;

    return this;
  });





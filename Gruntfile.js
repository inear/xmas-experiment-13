'use strict';

var fs = require('fs');
var path = require('path');
var json = require('component-json');

var stringToJs = require('component-string');

module.exports = function(grunt) {

  grunt.initConfig({

    // This will load in our package.json file so we can have access
    // to the project name and version number.
    pkg: grunt.file.readJSON('package.json'),

    BASE_PATH: './',
    DEVELOPMENT_PATH: './',
    PRODUCTION_PATH: './prod/',

    env : {
      options : {
      //Shared Options Hash
      },
      dev : {
        NODE_ENV : 'dev',
        DEST     : 'build'
      },
      prod : {
        NODE_ENV : 'prod',
        DEST     : 'prod'
      }
    },

    clean: {
      all: ['prod'],
      prod: ['prod']

    },

    banner: [
       '/*',
       '* Project: <%= pkg.name %>',
       '* Version: <%= pkg.version %> (<%= grunt.template.today("yyyy-mm-dd") %>)',
       '* Development By: <%= pkg.developedBy %>',
       '* Copyright(c): <%= grunt.template.today("yyyy") %>',
       '*/'
    ],

    // Install component.js dependencies.
    shell: {
      installcomponents: {
        command: 'component install -f'
      }
    },

    // Rebuild when we save a file.
    watch: {
      css: {
        files: ['**/*.scss'],

        tasks: ['compass:dev']
      },
      component: {
        files: [
          'app/**/*.js',
          'lib/**/*.css',
          'app/shaders/**/*.glsl',
        ],
        tasks: ['component_build:dev']
      },
      geometries: {
        files: ['geometries/**/*.obj'],
        tasks: ['geometries']
      }
    },

    three_obj: {
      dist: {
        src: ['geometries/**/*.obj']
      }
    },

    bundles: {
      geometries: {
        name: '',
        src: 'geometries',
        dest: 'app/geometries/'
      }
    },

    // Start local server.
    connect: {
      // localhost:4000
      dev: {
        options: {
          port: 4040,
          base: ''
        }
      }
    },

    // To keep your code clean, cowboy !
    jshint: {
      all: ['Gruntfile.js', 'lib/app/**/*.js', 'lib/**/*.js'],
      options: {
        jshintrc: '.jshintrc',
      }
    },

    // Build sass/compass styles.
    compass: {
      dev: {
        options: {
          config: 'config/compass-dev.rb',
        }
      },
      prod: {
        options: {
          config: 'config/compass-prod.rb',
          environment: 'production',
          force: true
        }
      },
    },

    // Build component.js module.
    component_build: {
      dev: {
        output: 'build',
        base: '',
        name: 'app',
        scripts: true,
        styles: false,
        sourceUrls: false,
        configure: function(builder) {
          builder.use(stringToJs);
          builder.use(json());
        }
      },
      prod: {
        output: 'prod',
        base: '',
        name: 'app',
        scripts: true,
        styles: false,
        sourceUrls: false,
        configure: function(builder) {
          builder.use(stringToJs);
          builder.use(json());
        }
      }
    },

    copy: {
      prod: {
        files: [{
          expand: true,
          filter: 'isFile',
          src: ['assets/**'],
          dest: 'prod'
        }
        ]
      }
    },

    preprocess : {
      options: {
        context : {
          DEBUG: true
        }
      },
      html : {
        src : 'index.html',
        dest : 'prod/index.html'
      }
    },

    useminPrepare: {
      html: 'index.html',
      options: {
          dest: 'prod'
      }
    },

    usemin: {
     html: 'prod/index.html'
    }

  });



  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-compass');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-component-build');
  grunt.loadNpmTasks('grunt-env');
  grunt.loadNpmTasks('grunt-preprocess');
  grunt.loadNpmTasks('grunt-usemin');
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-three-obj');

  grunt.registerMultiTask('bundles', 'Generates bundles', function() {
    var basepath = this.data.src;
    var dest = this.data.dest;
    var folder = fs.readdirSync(basepath);
    
    var folderpath = basepath;
    var isFirst = true;

    if (!fs.lstatSync(folderpath).isDirectory()) {
      return;
    }

    var output = 'module.exports = {';

    fs.readdirSync(folderpath).forEach(function(filename) {
      if (path.extname(filename) !== '.js') {
        return;
      }

      if (!isFirst) {
        output += ',';
      }

      var content = grunt.file.read(path.join(folderpath, filename));
      output += '"' + path.basename(filename, '.js') + '":' + JSON.stringify(content);

      isFirst = false;
    });

    output += '}';

    grunt.file.write(dest + '/package.js', output);
  });
  

  grunt.registerTask('geometries', ['three_obj','bundles']);

  grunt.registerTask('default', ['dev']);

  grunt.registerTask('prod', [
      'geometries',
      'env:prod',
      //'clean:prod',
      'compass:prod',
      //'shell:installcomponents',
      'component_build:prod',
      'copy:prod',
      'preprocess',
      'useminPrepare',
      'concat',
      'uglify',
      'usemin',
    ]);


  grunt.registerTask('server', ['connect:dev']);
  grunt.registerTask('dev', [
    'geometries',
    'env:dev',
    'compass:dev', 
    //'shell:installcomponents',
    'component_build:dev', 
    'server', 
    'watch']);
};
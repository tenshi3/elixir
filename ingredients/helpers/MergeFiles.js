var gulp = require('gulp');
var config = require('laravel-elixir').config;
var plugins = require('gulp-load-plugins')();
var utilities = require('./Utilities');
var fs = require('fs');

/**
 * Determine if we need to concat multiple sets,
 * but the user didn't specify output filenames.
 *
 * @param  {string}  assets
 * @param  {string}  fileName
 * @param  {string}  extension
 * @return {boolean}
 */
var multipleConcatsWithoutOutputPaths = function(assets, fileName, extension) {
    return assets.length !== 1 && fileName == 'all' + extension
};

/**
 * Apply an index to an existing filename, before the extension.
 *
 * @param  {string} index
 * @param  {string} fileName
 * @param  {string} extension
 * @return {string}
 */
var applyIndexToOutputPath = function(index, fileName, extension) {
    return fileName.replace(extension, '-' + index + extension);
}

/**
 * Queue up a request for file concatenations.
 *
 * @param  {object} options
 * @return {void}
 */
var queueAssetCombining = function(options) {
    var baseDir = options.baseDir || 'public';
    var type = options.type;
    var concatFileName = 'all.' + type;
    var outputDir = options.outputDir || config[type + 'Output'];
    var files = options.files || '**/*.' + type;

    // If the user set the outputDir to a file name, rather than
    // a directory, we'll need to compensate for that.
    if (outputDir.indexOf('.' + type) > -1) {
        var pathSegments = options.outputDir.split('/');

        concatFileName = pathSegments.pop();
        outputDir = pathSegments.join('/');
    }

    // We'll queue a new array of files to be concatenated with Gulp.
    // This way, multiple sets of of files may be concatenated.
    config.concatenate[type].push({
        src: utilities.prefixDirToFiles(baseDir, files),
        to: outputDir,
        concatFileName: concatFileName
    });

    // We only need to queue and register a watcher once.
    if (config.tasks.indexOf(options.taskName) == -1) {
        config.registerWatcher(options.taskName, baseDir + '/**/*.' + type);

        config.queueTask(options.taskName);
    }
};


/**
 * Create the Gulp task.
 *
 * @return {void}
 */
var buildTask = function(options) {
    gulp.task(options.taskName, function() {
        var assets = config.concatenate[options.extension];
        var stream;

        assets.forEach(function(set, index) {
            stream = mergeFileSet(set, index, assets, options);
        });

        return stream;
    });
};


/**
 * Use Gulp to merge one set of files.
 *
 * @param  {object}  set
 * @param  {index}   index
 * @param  {options} options
 * @return {object}
 */
var mergeFileSet = function(set, index, assets, options) {
    var fileName = set.concatFileName;
    var extension = '.' + options.extension;
    var mergePath;

    // If we're dealing with multiple asset concats, but the user didn't give
    // us a filename to use, then we'll add an index to the file name.
    if (multipleConcatsWithoutOutputPaths(assets, fileName, extension))
    {
        fileName = applyIndexToOutputPath(++index, fileName, extension);
    }

    mergePath = [set.to, fileName].join('/');
    if (fs.existsSync(mergePath)) {
        fs.unlinkSync(mergePath);
    }

    return gulp.src(set.src)
               .pipe(plugins.concat(fileName))
               .pipe(plugins.if(config.production, options.minifier.call(this)))
               .pipe(gulp.dest(set.to));
};


module.exports = function(options) {

    queueAssetCombining({
        type: options.extension,
        files: options.assets,
        baseDir: options.baseDir,
        outputDir: options.output,
        taskName: options.taskName
    });

    buildTask(options);

    return config;

};
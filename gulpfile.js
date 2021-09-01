const gulp			= require('gulp');
const plugins		= require('gulp-load-plugins');
const browser		= require('browser-sync');
const rimraf		= require('rimraf');
const panini		= require('panini');
const lazypipe		= require('lazypipe');
const mjml			= require('gulp-mjml');
const styleInject	= require('gulp-style-inject');
const fs			= require('fs');
const replace		= require('gulp-string-replace');
const yargs			= require('yargs');
const siphon		= require('siphon-media-query');
const strip			= require('gulp-strip-comments');
//const flatmap		= require('gulp-flatmap');
//const mjmlUtils		= require('mjml-utils');
//const PluginError	= require("plugin-error");
//const through 		= require('through2');
//const nunjucksRender		= require('gulp-nunjucks-render');

const { series }	= require('gulp');

const $ 			= plugins();

//var PRODUCTION	= false;
const PRODUCTION = !!(yargs.argv.production);

// Build the "dist" folder by running all of the below tasks
//gulp.task('build',
//		  gulp.series(clean, pages, sass, inline));

// Build emails, run the server, and watch for file changes
//gulp.task('default',
//		  gulp.series('build', server, watch));

// Delete the "dist" folder
// This happens every time a build starts
function clean(done) {
	rimraf('mjmlComplete', done);
	rimraf('dist', done);
}

//Compile & Render MJML Pages
function mjmlPages() {
	return gulp.src(['paniniComplete/**/*.html', '!src/pages/archive/**/*.html'])
	.pipe(flatmap(function(stream, file) {
		return stream
		.pipe(mjml());
	}))
//	.pipe(mjml())
	.pipe(gulp.dest('mjmlComplete/pages'));
}

//Compile & Render MJML Layouts
function mjmlLayouts() {
	return gulp.src(['src/layouts/**/*.mjml'])
	.pipe(mjml())
	.pipe(gulp.dest('mjmlComplete/layouts'));
}

//Compile & Render MJML Partials
function mjmlPartials() {
	return gulp.src(['src/partials/**/*.mjml'])
	.pipe(mjml())
	.pipe(gulp.dest('mjmlComplete/partials'));
}

function mjmlCompose() {
	return gulp.src(['paniniComplete/**/*.mjml'])
	.pipe(mjml())
	.pipe(gulp.dest('dist'));
}

//function mjmlUtilsSelect ( utilToUse, jsonToInject ) {
//	return through.obj(function(file, enc, callback){
//		if (file.isBuffer()) {
//			const output = file.clone();
//			if(utilToUse == 'inject') {
//				let render = mjmlUtils.inject(file.content, jsonToInject)
//				.then(finalTemplate => {});
//				output.contents = Buffer.from(render.html);
//				this.push(output);
//			}
//		}
//		return callback();
//	});
//	
//}

// Compile layouts, pages, and partials into flat HTML files
// Then parse using Inky templates
function pages() {
	return gulp.src(['src/pages/**/*.mjml', '!src/pages/archive/**/*.mjml'])
	.pipe(panini({
      root: 'src/pages',
      layouts: 'src/layouts',
      partials: 'src/partials',
      helpers: 'src/helpers',
	  data: 'src/data'
    }))
	.pipe(gulp.dest('paniniComplete'));
}

// Reset Panini's cache of layouts and partials
function resetPages(done) {
	panini.refresh();
	done();
}

// Compile Sass into CSS
function sass() {
	return gulp.src('src/assets/scss/app.scss')
	.pipe($.if(!PRODUCTION, $.sourcemaps.init()))
	.pipe($.sass({
		includePaths: ['node_modules/foundation-emails/scss']
	}).on('error', $.sass.logError))
	.pipe($.if(PRODUCTION, $.uncss({
		html: ['dist/**/*.html']
	})))
	.pipe($.if(!PRODUCTION, $.sourcemaps.write()))
	.pipe($.sourcemaps.write())
	.pipe(gulp.dest('dist/css'));
}

// Inline CSS and minify HTML
function inline() {
//	var css = fs.readFileSync( 'dist/css/app.css' ).toString();
	return gulp.src('dist/**/*.html')
	.pipe($.if(PRODUCTION, inliner('dist/css/app.css')))
    .pipe(gulp.dest('dist'));
//	.pipe(inliner('dist/css/app.css'))
//	.pipe(styleInject({
//		encapsulated: false,
//		path: '/dist/css'
//	}))
//	.pipe(replace('<!-- <style> -->', css ))
//	.pipe(gulp.dest('dist'));
}

// Inlines CSS into HTML, adds media query CSS into the <style> tag of the email, and compresses the HTML
function inliner(css) {
	var css = fs.readFileSync(css).toString();
	var mqCss = siphon(css);
	var pipe = lazypipe()
	.pipe($.replace, '<!-- <style> -->', `<style>${css}</style>`)
	.pipe($.replace, '<link rel="stylesheet" type="text/css" href="css/app.css">', '')
	.pipe($.htmlmin, {
		collapseWhitespace: true,
		minifyCSS: true
	});
	return pipe();
}

//remove html comments
function comments() {
	return gulp.src('dist/**/*.html')
	// .pipe($.if(PRODUCTION, strip({safe: true})))
	.pipe(gulp.dest('dist'));
}

// Start a server with LiveReload to preview the site in
function server(done) {
	browser.init({
		server: 'dist',
		port: 9150
	});
	done();
}

// Watch for file changes
function watch() {
	gulp.watch('src/pages/**/*').on('all', gulp.series(pages, mjmlCompose, browser.reload));
	gulp.watch(['src/layouts/**/*', 'src/partials/**/*', 'src/data/**/*']).on('all', gulp.series(resetPages, pages, mjmlCompose, browser.reload));
	gulp.watch(['../scss/**/*.scss', 'src/assets/scss/**/*.scss']).on('all', gulp.series(resetPages, sass, pages, mjmlCompose, inline, browser.reload));
//	gulp.watch('src/assets/img/**/*').on('all', gulp.series(images, browser.reload));
}


// Build the "dist" folder by running all of the below tasks
exports.build = series( clean, pages, mjmlCompose, sass, inline, comments );

// Build emails, run the server, and watch for file changes
exports.default = series( clean, pages, mjmlCompose, sass, inline, comments, server, watch );

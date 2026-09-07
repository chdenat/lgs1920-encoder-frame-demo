/** Configure Eleventy for the standalone frame streaming demonstration. */
export default function configureEleventy(eleventyConfig) {
    eleventyConfig.addPassthroughCopy({
        'src/assets': 'assets',
    })

    return {
        dir: {
            input: 'src',
            output: 'dist',
        },
        templateFormats: ['liquid'],
        htmlTemplateEngine: 'liquid',
    }
}

const { cpSync, rmSync } = require('fs');
const path = require('path');
const { version } = require("./package.json");
const { DefinePlugin } = require('webpack');

rmSync("./dist", { recursive: true, force: true });
cpSync("./static", "./dist", { recursive: true });

module.exports = [
    {
        mode: 'development',
        devtool: 'eval-source-map',
        experiments: {
            outputModule: true,
            topLevelAwait: true,
        },
        entry: './src/index.js',
        output: {
            publicPath: "/",
            filename: 'tokex.js',
            path: path.resolve(__dirname, 'dist'),
        },
        devServer: {
            static: 'static',
            port: 8734,
            historyApiFallback: true,
        },
        module: {
            rules: [
                {
                    test: /\.proto$/,
                    use: {
                        loader: 'pbf-loader',
                    },
                },
            ]
        },
        plugins: [
            new DefinePlugin({
                'globalThis.VERSION': JSON.stringify(version),
            })
        ]
    }
];
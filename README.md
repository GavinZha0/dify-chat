![Dify Chat](./docs/banner.png)


**Dify Chat (Customized Fork)** 

This is a fork of [Dify Chat](https://github.com/lexmin0412/dify-chat).

It includes some minor modifications and adjustments to make it work for internal team use (frontend only).

If you are looking for the full features and the latest updates, please visit [Dify Chat](https://github.com/lexmin0412/dify-chat).

## Modifications

- User login/logout for frontend
- Applications grouping by tag
- Unsafe app/user authorization (Do not use in the product)
- App list on conversation page
- External links for app
- Internationalization support: Chinese and English

## Deployment (frontend only)
1. pnpm -r build
2. docker build -f Dockerfile_frontend -t dify-chat:0.5.5 .
3. docker run -d -p 5200:80 --name dify-chat dify-chat:0.5.5
4. admin login with 'DifyChat520'


## License

[MIT](./LICENSE)


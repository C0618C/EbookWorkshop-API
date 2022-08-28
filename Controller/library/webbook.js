const DO = require("../../Core/OTO/DO");
const WebBookMaker = require("./../../Core/WebBook/WebBookMaker");
const Server = require("./../../Core/Server");



module.exports = () => ({
    /**
     * @swagger
     * /library/webbook:
     *   get:
     *     tags:
     *       - Library - WebBook —— 网文图书馆
     *     summary: 拿到指定ID的书
     *     description: 拿到指定ID的书
     *     parameters:
     *     - name: bookid
     *       in: query
     *       required: true
     *       description: 需获取的书ID
     *       schema:
     *         type: integer
     *         format: int32
     *     consumes:
     *       - application/json
     *     responses:
     *       200:
     *         description: 请求成功
     *       600:
     *         description: 参数错误，参数类型错误
     */
    "get ": async (ctx) => {
        let bookId = ctx.query.bookid;
        if (bookId * 1 != bookId) {
            ctx.status = 600;
            return;
        }

        ctx.body = await DO.GetWebBookById(bookId * 1);
    },

    /**
     * @swagger
     * /library/webbook:
     *   post:
     *     tags:
     *       - Library - WebBook —— 网文图书馆
     *     summary: 创建书
     *     description: 通过传入网文目录页，建立对应的书籍
     *     parameters:
     *     - name: bookIndexUrl
     *       in: body
     *       required: true
     *       description: 需获取的书的目录地址
     *       schema:
     *         type: string
     *     consumes:
     *       - application/json
     *     responses:
     *       200:
     *         description: 请求成功
     *       600:
     *         description: 参数错误，参数类型错误
     */
    "post ": async (ctx) => {
        let bookUrl = await Server.parseBodyData(ctx);

        let wbm = new WebBookMaker(bookUrl);
        await wbm.UpdateIndex()
            .then(result => {
                let book = wbm.GetBook();
                ctx.body = JSON.stringify(book);
            }).catch((err) => {
                ctx.body = JSON.stringify({ ret: 1, err: err.message, url: bookUrl });
            });
    },

    /**
     * @swagger
     * /library/webbook:
     *   delete:
     *     tags:
     *       - Library - WebBook —— 网文图书馆
     *     summary: 删除指定ID的书
     *     description: 删除指定ID的书
     *     parameters:
     *     - name: bookid
     *       in: query
     *       required: true
     *       description: 将要删除书ID
     *       schema:
     *         type: integer
     *         format: int32
     *     consumes:
     *       - application/json
     *     responses:
     *       200:
     *         description: 请求成功
     *       600:
     *         description: 参数错误，参数类型错误
     */
    "get ": async (ctx) => {
        let bookId = ctx.query.bookid;
        if (bookId * 1 != bookId) {
            ctx.status = 600;
            return;
        }

        ctx.body = await WebBookMaker.DeleteOneBook(bookId);
    },

    /**
     * @swagger
     * /library/webbook/updatechapter:
     *   patch:
     *     tags:
     *       - Library - WebBook —— 网文图书馆
     *     summary: 更新指定章节
     *     description: 根据提供的章节ID数组，重新爬取这些ID；如果没有指定章节，则将所有已有正文的章节都算上
     *     parameters:
     *       - in: body
     *         name: bookInfo
     *         description: 需要更新的书目ID，章节信息
     *         schema:
     *           type: object
     *           required:
     *             - bookId
     *           properties:
     *             bookId:
     *               type: integer
     *               format: int32
     *             chapterIds:
     *               type: array
     *               items:
     *                 type: integer
     *                 format: int32
     *             isUpdate:
     *               type: boolean
     *               example: false
     *     consumes:
     *       - application/json
     *     responses:
     *       200:
     *         description: 请求成功
     *       600:
     *         description: 参数错误，参数类型错误
     */
    "patch /updatechapter": async (ctx) => {
        let param = await Server.parseJsonFromBodyData(ctx, ["bookId"]);

        let b = await DO.GetWebBookById(param.bookId);

        let cIds = param.chapterIds;
        if (!cIds || cIds.length == 0) {
            cIds = [];
            for (let i of b.Index) {
                if (i.IsHasContent) continue;
                cIds.push(i.IndexId);
            }
        }

        if (cIds.length == 0) {
            ctx.body = JSON.stringify({ ret: 1, err: "所有章节已有内容，若需要更新请提供指定章节ID，并开启强制更新。", bookname: ebook.BookName });
            return;
        }

        let wbm = new WebBookMaker(b);
        await wbm.UpdateChapter(cIds, param.isUpdate).then((rsl) => {
            ctx.body = JSON.stringify({ ret: 0, data: rsl });
        }).catch((err) => {
            ctx.body = JSON.stringify({ ret: 1, data: param, err: err.message });
        });
    }
});
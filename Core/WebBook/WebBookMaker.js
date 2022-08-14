//爬取、组织、校验等 电子书处理的所有逻辑

const WebBook = require("./../../Entity/WebBook/WebBook.js");
const WebIndex = require("./../../Entity/WebBook/WebIndex.js");
const WebChapter = require("./../../Entity/WebBook/WebChapter.js");
const { GetDataFromUrl } = require("./GetDataFromUrl.js");
const RuleManager = require("./RuleManager.js");
const EventManager = require("./../EventManager.js");


class WebBookMaker {
    /**
     * 创建一个Web电子书操作器
     * @param {*} webbook 待操作的WebBook对象，或根据提供的目录地址创建一本新书操作器
     * @returns 
     */
    constructor(webbook) {
        if (typeof (webbook) === "string") {
            this.myWebBook = this.InitEmptyFromIndex(webbook);
            return;
        }

        if (!webbook) this.myWebBook = new WebBook();
        //else this.myWebBook = webbook;
    }

    GetBook() {
        return this.myWebBook;
    }

    /**
     * 更新章节目录
     * @param {*} url 默认为空，在章节分页时递归往下找
     * @returns 
     */
    UpdateIndex(url = "") {
        let curUrl = url || this.myWebBook.IndexUrl[this.myWebBook.defaultIndex];
        const webRule = RuleManager.GetRuleByURL(curUrl);
        const option = { RuleList: webRule.index.GetRuleList() }

        return GetDataFromUrl(curUrl, option).then((result) => {
            //初始化书名
            if (result.has("BookName") && this.myWebBook.WebBookName == "") {
                let bn = result.get("BookName")[0];
                this.myWebBook.WebBookName = bn.text;
                if (this.myWebBook.BookName == "") this.myWebBook.BookName = bn.text;
            }

            if (result.has("ChapterList")) {
                let cl = result.get("ChapterList");
                this.MargeIndex(cl);
            }

            if (result.has("NextPage")) {
                let npData = result.get("NextPage")[0];
                let nextPage = npData.url;
                if (nextPage == "") {
                    new EventManager().emit("WebBook.UpdateIndex.Finish", this.myWebBook.BookId);
                    return;
                }

                // console.log(`开始爬下一页：${nextPage}`);
                return this.UpdateIndex(nextPage);
            }
        });
    }



    /**
     * 更新指定章节
     * @param {int} cIndex 章节索引
     */
    async UpdateOneChapter(cIndex) {
        if (this.myWebBook == null) {
            console.warn("[WebBookMaker::UpdateOneChapter] 尚未加载电子书，操作失败。");
            return;
        }

        let curCp = this.myWebBook.Index[cIndex];

        if (!curCp) {
            console.warn(`[WebBookMaker::UpdateOneChapter] 指定章节(${cIndex})并不存在，请先建立目录。`);
            return;
        }

        let cs = this.myWebBook.Chapters;
        if (cs.has(curCp.WebTitle)) return;        //已存在的内容跳过

        let url = this.GetDefaultUrl(cIndex);
        if (!url) return;

        // console.log("[DEBUG]开始爬：", url);

        const webRule = RuleManager.GetRuleByURL(url);
        const option = { RuleList: webRule.chapter.GetRuleList() }

        return await GetDataFromUrl(url, option).then(async (result) => {
            let chap = new WebChapter();
            chap.Title = curCp.Title;
            chap.WebTitle = curCp.WebTitle;
            if (result.has("CapterTitle")) {
                chap.Title = result.get("CapterTitle")[0].text;
            }

            if (result.has("Content")) {
                chap.Content = result.get("Content")[0].text;
            }

            //下一页
            if (result.has("NextPage")) {
                let nextPageResult = result.get("NextPage")[0];
                while (nextPageResult.text == nextPageResult.Rule.CheckSetting) {        //TODO: 这应该弄个规则解释器和配套的校验规则表达式
                    let npUrl = nextPageResult.url;
                    if (!npUrl) break;

                    let tempResult = await GetDataFromUrl(npUrl, option);
                    chap.Content += tempResult.get("Content")[0].text;
                    nextPageResult = tempResult.get("NextPage")[0];
                }
            }

            cs.set(curCp.WebTitle, chap);

            new EventManager().emit("WebBook.UpdateOneChapter.Finish", this.myWebBook.BookId, cIndex, chap.WebTitle);
        });
    }

    /**
     * 批量更新章节
     * @param {Array} cIndex 
     */
    UpdateChapter(cIndex) {
        let doneNum = 0;//已完成数
        let allNum = cIndex.length;
        let doList = [];

        for (let id of cIndex) {
            if (!this.myWebBook.Index[id]) {
                allNum--;
                continue;
            }

            this.UpdateOneChapter(id);
            doList.push(id);
        }

        let em = new EventManager();

        em.on("WebBook.UpdateOneChapter.Finish", (bookid, chapterIndex, title) => {
            doneNum++;

            if (allNum == doneNum) {
                em.emit("WebBook.UpdateChapter.Finish", bookid, doList);
            }
        })
    }

    /**
     * 检查空页
     */
    static CheckIsEmpty() {

    }


    /**
     * 从目录页初始化一本空书
     * @param {string} indexUrl 
     */
    InitEmptyFromIndex(indexUrl) {

        let curbook = new WebBook();
        //curbook.BookId = 
        curbook.IndexUrl.push(indexUrl);

        this.myWebBook = curbook;

        return curbook;
    }


    ///----------------私有方法---------------------------
    /**
         * 合并章节目录（爬到的章节内容合并更新到本书内
         * @param {{text,url}} index 
         */
    MargeIndex(index) {
        //console.log(JSON.stringify(index, null, 2));      {text,url}
        //this.myWebBook.Index

        let bookIndex = this.myWebBook.Index;
        let addItem = new Map();
        for (let i of index) {
            let hasFind = false;
            for (let bi of bookIndex) {
                if (bi.URL.includes(i.url)) {
                    hasFind = true;
                    continue;
                } else if (bi.WebTitle == i.text) {//标题能对上，来源地址对不上时，合并来源
                    hasFind = true;
                    bi.URL.push(i.url);
                }
            }

            if (!hasFind) {
                if (addItem.has(i.text)) {                    //已存在的章节合并-标题重复的章节
                    let curItem = addItem.get(i.text);
                    curItem.URL.push(i.url);
                    continue;
                }

                let iItem = new WebIndex({ title: i.text });
                iItem.URL.push(i.url);
                addItem.set(i.text, iItem);
            }
        }

        bookIndex.push(...addItem.values());

        // console.log(JSON.stringify(bookIndex, "", 4));
    }

    /**
     * 取得章节来源网址
     * ——多来源时选取合适的地址
     * @param {int} cIndex 章节索引
     */
    GetDefaultUrl(cIndex) {
        let indexUrl = this.myWebBook.IndexUrl[this.myWebBook.defaultIndex];
        let hostName = RuleManager.GetHost(indexUrl);

        for (let u of this.myWebBook.Index[cIndex]?.URL) {
            if (u.includes(hostName)) return u;
        }

        return this.myWebBook.Index[cIndex]?.URL[0];
    }

}


module.exports = WebBookMaker;
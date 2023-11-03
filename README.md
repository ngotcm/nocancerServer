nocancerServer
==============

天下無癌網鏡像網站代碼。

##Install

1. 已经没有镜像文件见了，不要再发送请求。~~取得鏡像文件，請發郵件至 inaction.me#gmail.com 索取；~~
2. 安裝 nodejs 環境， 參考 http://nodejs.org
3. 獲取代碼:


   ``` 
git clone https://github.com/ngotcm/nocancerServer.git
cd nocancerServer
npm install 
```  

4. 將鏡像文件解壓至目錄`./www.nocancer.com.cn`
5. 執行 `node server.js` 
6. 在瀏覽器訪問 http://localhost:1231 即可瀏覽鏡像網站； 

##Change Log
v1.3
* Add simple logger;
* Format www request log, show real IP in log.

v1.2
* Fix default page error, set default page param as 1;
* Add other php request handler.

v1.1 
* Remove crowlit lib.
* Update mirror file to nocancer-20140918.tz2

##license 
MIT 

# ReteWebController
COMP8047 Practicum Project

Setting up in intelliJ:
1. Navigate to serverlink, this is source code root. Open serverlink.iml in IntelliJ

2. run npm install

3. run mvn install

4. Create run & debug configurations in IntelliJ (clicking green arrow next to main method in App.java will generate it)

Server:
Create the standalone server "serverlink-1.0-SNAPSHOT-shaded.jar"
	mvn install

Web:
	Release:
		npm run buildDev
		npm run buildProd
	Debug:
		(without server running)
		npm run headless
		(with server running, need to restart server to apply changes)
		npm run devServer

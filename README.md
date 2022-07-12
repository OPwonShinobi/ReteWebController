# ReteWebController
COMP8047 Practicum Project

Setting up in intelliJ:
1. Navigate to serverlink, this is source code root. Open serverlink.iml in IntelliJ

2. run npm install

3. run mvn install

4. Create run & debug configurations in IntelliJ (clicking green arrow next to main method in App.java will generate it)

## Server ##
Run ```mvn install``` to create standalone jar "serverlink-1.0-SNAPSHOT-shaded.jar"

## Web ##
	Release:
		npm run buildDev
		npm run buildProd
	Debug:
		(with server running, refresh page to apply changes)
		npm run devServer

FROM node as node_cache
COPY package.json .
COPY package-lock.json .
RUN npm install

FROM node as node_build
COPY --from=node_cache node_modules node_modules
COPY package.json package.json
COPY webpack.config.js webpack.config.js
COPY public public
COPY config config
RUN npm run buildProd

FROM maven as java_build
COPY src src
COPY pom.xml .
COPY config config
RUN mvn install

FROM amazoncorretto:8
COPY --from=java_build target/serverlink*shaded*.jar serverlink.jar
COPY --from=node_build dist dist
COPY config/config.json config/config.json
CMD ["java", "-jar", "serverlink.jar"]
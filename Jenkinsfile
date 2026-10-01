// =====================================================================
// Jenkins pipeline: Campus Events with accessibility & performance gate
//
// Needs on the Jenkins machine: Node.js 22, Docker + Docker Compose.
// The jenkins/ folder has a ready-made Jenkins image that includes both.
//
// Optional credentials (Manage Jenkins > Credentials), used only when
// the PUSH_IMAGE / DEPLOY_PROD build parameters are ticked:
//   dockerhub-creds      Username/password for Docker Hub   (push stage)
//   render-deploy-hook   Secret text: Render deploy hook URL (prod deploy)
// =====================================================================

pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '15'))
    disableConcurrentBuilds()
  }

  parameters {
    booleanParam(name: 'PUSH_IMAGE', defaultValue: false, description: 'Push the image to Docker Hub (needs dockerhub-creds)')
    booleanParam(name: 'DEPLOY_PROD', defaultValue: false, description: 'Deploy to Render (needs render-deploy-hook)')
  }

  environment {
    IMAGE          = 'a11ygate'
    DOCKERHUB_REPO = 'your-dockerhub-username/a11ygate'   // change me
    STAGING_PORT   = '8081'
    NODE_OPTIONS   = '--no-deprecation'
    PUPPETEER_SKIP_DOWNLOAD = 'true'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.TAG = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.FULL_SHA = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
          env.ON_MAIN = (env.BRANCH_NAME == 'main' || env.GIT_BRANCH in ['main', 'origin/main']).toString()
        }
        echo "Building commit ${env.TAG} (main branch: ${env.ON_MAIN})"
      }
    }

    stage('Install') {
      steps {
        sh 'node --version && npm --version'
        sh 'npm ci'
      }
    }

    stage('Lint & Unit tests') {
      environment { JEST_JUNIT_OUTPUT_DIR = 'reports/junit' }
      steps {
        sh 'npm run lint'
        sh 'npx jest --ci --coverage --reporters=default --reporters=jest-junit'
      }
      post {
        always { junit allowEmptyResults: true, testResults: 'reports/junit/*.xml' }
      }
    }

    stage('Docker build') {
      steps {
        sh "docker build --build-arg GIT_SHA=${env.FULL_SHA} -t ${IMAGE}:${env.TAG} -t ${IMAGE}:ci ."
        sh "docker image ls ${IMAGE}:${env.TAG}"
      }
    }

    stage('Quality gates (pa11y-ci + Lighthouse CI)') {
      steps {
        // App + QA runner in containers; qa's exit code decides pass/fail
        sh """
          IMAGE=${IMAGE}:${env.TAG} docker compose -p a11ygate-${env.BUILD_NUMBER} -f docker-compose.ci.yml \
            up --build --abort-on-container-exit --exit-code-from qa
        """
      }
      post {
        always {
          // Copy reports out of the (stopped) qa container, then clean up
          sh """
            rm -rf reports/pa11y reports/lighthouse reports/summary.md
            docker cp \$(docker compose -p a11ygate-${env.BUILD_NUMBER} -f docker-compose.ci.yml ps -aq qa):/qa/reports/. reports/ || true
            docker compose -p a11ygate-${env.BUILD_NUMBER} -f docker-compose.ci.yml down -v || true
          """
          archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
          publishHTML(target: [
            reportName: 'Accessibility report (pa11y)',
            reportDir: 'reports/pa11y/html', reportFiles: 'index.html',
            keepAll: true, alwaysLinkToLastBuild: true, allowMissing: true
          ])
          script {
            if (fileExists('reports/summary.md')) { echo readFile('reports/summary.md') }
          }
        }
      }
    }

    stage('Deploy to staging') {
      // Runs on every branch so you can open the result in a browser during the demo
      steps {
        sh """
          docker rm -f a11ygate-staging || true
          docker run -d --name a11ygate-staging --restart unless-stopped -p ${STAGING_PORT}:3000 ${IMAGE}:${env.TAG}
          for i in \$(seq 1 30); do
            [ "\$(docker inspect -f '{{.State.Health.Status}}' a11ygate-staging)" = "healthy" ] && break
            sleep 2
          done
          docker inspect -f '{{.State.Health.Status}}' a11ygate-staging | grep -q healthy
        """
        echo "Staging is live at http://localhost:${STAGING_PORT}"
      }
    }

    stage('Push image to Docker Hub') {
      when { expression { env.ON_MAIN == 'true' && params.PUSH_IMAGE } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
          sh '''
            echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
            docker tag $IMAGE:$TAG $DOCKERHUB_REPO:$TAG
            docker tag $IMAGE:$TAG $DOCKERHUB_REPO:latest
            docker push $DOCKERHUB_REPO:$TAG
            docker push $DOCKERHUB_REPO:latest
            docker logout
          '''
        }
      }
    }

    stage('Deploy to production (Render)') {
      when { expression { env.ON_MAIN == 'true' && params.DEPLOY_PROD } }
      steps {
        withCredentials([string(credentialsId: 'render-deploy-hook', variable: 'HOOK')]) {
          sh 'curl -fsS -X POST "$HOOK"'
        }
      }
    }
  }

  post {
    success { echo '✅ All gates passed: the build is accessible and fast.' }
    failure { echo '❌ Pipeline failed. Open "Accessibility report (pa11y)" or the archived Lighthouse reports to see why.' }
  }
}

# Helm deployment for `hello-node-api`

This file describes how to build the container image, push it to a registry, and deploy the app to a Kubernetes cluster using the Helm chart at `chart/hello-node-api`.

Prerequisites:

- Docker (or another OCI builder) configured to push images to your registry
- A Kubernetes cluster reachable by your `kubectl` and `helm` (Helm v3)
- Credentials to push to your image registry

1. Build and push the image

Replace `your-registry` and `1.0.0` with your registry and tag.

```bash
docker build -t your-registry/hello-node-api:1.0.0 .
docker push your-registry/hello-node-api:1.0.0
```

2. Install the chart

You can either edit `chart/hello-node-api/values.yaml` to set `image.repository` and `image.tag`, or provide overrides on the command line.

```bash
helm install my-release chart/hello-node-api \
  --set image.repository=your-registry/hello-node-api \
  --set image.tag=1.0.0
```

3. Upgrade (new image)

```bash
helm upgrade my-release chart/hello-node-api --set image.tag=1.0.1
```

4. Test locally with port-forward

```bash
kubectl port-forward svc/my-release-hello-node-api 3000:3000
# then visit http://localhost:3000
```

Notes:

- The chart sets `service.type` to `ClusterIP` by default. To expose through a LoadBalancer, install with `--set service.type=LoadBalancer`.
- If you want to use a private registry, ensure your cluster has the appropriate imagePullSecrets configured and set `image.pullSecrets` in `values.yaml`.

Environment variables

- The API uses `WEATHERAPI_KEY` to authenticate requests to WeatherAPI.com. Set this in your cluster (as a `Deployment` env var or using `Secrets`) or locally before running the app.

Example local run:

```bash
export WEATHERAPI_KEY=your_weatherapi_key_here
npm start
# then request: curl "http://localhost:3000/weather?q=London"
```

Using secrets with Helm (recommended)

Create a Kubernetes Secret containing your WeatherAPI key:

```bash
kubectl create secret generic my-weather-secret --from-literal=WEATHERAPI_KEY=your_weatherapi_key_here
```

Then install the chart and reference that secret:

```bash
helm install my-release chart/hello-node-api \
  --set image.repository=your-registry/hello-node-api \
  --set image.tag=1.0.0 \
  --set weatherApi.keySecretName=my-weather-secret
```

Alternatively (not recommended), you can set the key directly via `--set weatherApi.key=...` but avoid committing secrets into source control.

Override `WEATHERAPI_BASE_URL` (optional)

You can change the WeatherAPI base URL exposed to the pod using `weatherApi.baseUrl`. This value will be injected into the pod as the environment variable `WEATHERAPI_BASE_URL` so the application can be configured to point to a different endpoint (for testing or proxying).

Example (override base URL and reference secret):

```bash
helm install my-release chart/hello-node-api \
  --set image.repository=your-registry/hello-node-api \
  --set image.tag=1.0.0 \
  --set weatherApi.keySecretName=my-weather-secret \
  --set weatherApi.baseUrl="https://staging-proxy.example.com/v1"
```

Expose full config as JSON (`APP_CONFIG`)

The chart can also inject the application's configuration into the pod as a single JSON environment variable named `APP_CONFIG`. This contains the `port` and `weatherApi.baseUrl` fields. If you set the API key directly via `--set weatherApi.key=...` that key will be included in `APP_CONFIG` (not recommended). If you are using a Kubernetes Secret (`weatherApi.keySecretName`) the secret value will NOT be embedded inside `APP_CONFIG` — it will remain available separately as the environment variable `WEATHERAPI_KEY`.

Example: check the JSON inside a running pod

```bash
kubectl exec -it deploy/my-release-hello-node-api -- printenv APP_CONFIG
```

Use this with care: avoid placing secrets in `APP_CONFIG` unless you fully understand your cluster's security posture.

Per-environment Helm values

This repo includes per-environment values files under `chart/hello-node-api/`:

- `values-dev.yaml` — development defaults
- `values-qa.yaml` — QA defaults
- `values-prod.yaml` — production defaults (resources + replicas)

The CI workflow will automatically pass the appropriate file to Helm (for example `-f chart/hello-node-api/values-dev.yaml`) when deploying to an environment, and will fail the run if the file is missing. To customize behavior per environment, edit those files or add new ones and update the workflow accordingly.

If you prefer environment-specific values files tracked outside the chart (for secrets or per-cluster overrides), you can store them in a separate `ci/` directory and update the workflow to point to those files instead of the chart-local ones.

Note about the development API key

The development values file `chart/hello-node-api/values-dev.yaml` no longer contains a WeatherAPI key. This avoids committing sensitive values into source control. For local development or CI, prefer one of the following:

- Create a Kubernetes Secret in the dev cluster:
  ```bash
  kubectl create secret generic dev-weather-secret --from-literal=WEATHERAPI_KEY=your_weatherapi_key_here -n dev
  ```
- Use ExternalSecrets/Secret Manager so the cluster pulls the secret directly from a vault.
- For local development, copy `.env.example` to `.env` and set your key:
  ```bash
  cp .env.example .env
  # edit .env and then run
  npm start
  ```

If you want, I can add CI steps to create the `dev-weather-secret` from a GitHub Secret during deploys, or help set up ExternalSecrets.

Continuous delivery (dev → qa → prod)

This repository contains a GitHub Actions workflow at `.github/workflows/ci-cd.yml` that builds the container image, pushes it to the configured registry, and deploys the Helm chart to the target Kubernetes environment.

How the pipeline maps branches and environments:

- `dev` branch → deploys automatically to the `dev` namespace
- `qa` branch → deploys automatically to the `qa` namespace
- `prod` → deploy to `prod` is intended to be done via `workflow_dispatch` (manual run) to require an explicit promotion step

Required repository secrets (set these in GitHub > Settings > Secrets):

- `DOCKER_REGISTRY` — registry host (e.g., `docker.io` or `ghcr.io`)
- `DOCKER_USERNAME` and `DOCKER_PASSWORD` — credentials for the registry
- `IMAGE_REPOSITORY` — full image path (e.g., `your-registry/hello-node-api`)
- `KUBE_CONFIG_DEV`, `KUBE_CONFIG_QA`, `KUBE_CONFIG_PROD` — base64-encoded kubeconfig files for the cluster/context you want to deploy to for each environment

How to trigger production deploy manually:

1. Create a workflow dispatch run in Actions and set `environment=prod`.
2. The workflow will pick up `KUBE_CONFIG_PROD` and deploy into the `prod` namespace.

Security notes:

- Do not store secret values in `values.yaml` or in `APP_CONFIG` in production. Use `weatherApi.keySecretName` and Kubernetes Secrets instead.
- Protect GitHub Actions with branch protections and required reviewers for the `prod` promotion if desired.

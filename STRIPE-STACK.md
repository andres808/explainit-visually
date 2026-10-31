# Stripe Projects AI stack

[Open the stack recipe](https://projects.dev/s#v1:OpenRouter~api)

The project provisions an OpenRouter AI API resource. The source project's API resource and companion plan are both on the free tier. The shared URL encodes the API service; review the destination project's plan before using it.

To recreate the service in your own Stripe Project, use the Stripe CLI with the Projects plugin:

```sh
stripe projects init --from 'https://projects.dev/s#v1:OpenRouter~api'
```

The recipe does not contain credentials, account access, or application code. Store any generated credentials in server secrets and keep `.projects/` and `.env*` files out of Git.

This provisioned AI service is separate from the current public test app. The hosted app currently uses its configured Gemini endpoint for lessons and Ideogram for images. To use OpenRouter with a new deployment, configure `LLM_API_KEY`, an OpenAI-compatible `LLM_BASE_URL`, and an appropriate `LLM_MODEL` on the server. Adding the stack alone does not change the hosted app's provider.

[Stripe Projects documentation](https://docs.stripe.com/projects#share-a-project)

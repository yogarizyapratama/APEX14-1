import type { TSchema } from "@apex14/validation";
import type { Handler, RouteOptions } from "./types.js";
import type { ApexRequestContext } from "@apex14/http";

export interface ContractDefinition<
  TParams extends TSchema = TSchema,
  TQuery extends TSchema = TSchema,
  THeaders extends TSchema = TSchema,
  TBody extends TSchema = TSchema,
  TResponse extends TSchema = TSchema
> {
  params?: TParams;
  query?: TQuery;
  headers?: THeaders;
  body?: TBody;
  response?: TResponse;
  summary?: string;
  description?: string;
  tags?: string[];
}

export class ApexContract<
  TParams extends TSchema = TSchema,
  TQuery extends TSchema = TSchema,
  THeaders extends TSchema = TSchema,
  TBody extends TSchema = TSchema,
  TResponse extends TSchema = TSchema
> {
  public isContract = true as const;

  constructor(
    public definition: ContractDefinition<TParams, TQuery, THeaders, TBody, TResponse>
  ) {}

  public toRouteOptions(): RouteOptions {
    return {
      params: this.definition.params,
      query: this.definition.query,
      body: this.definition.body,
      response: this.definition.response,
      summary: this.definition.summary,
      description: this.definition.description,
      tags: this.definition.tags
    };
  }

  public handle(
    handler: (ctx: ApexRequestContext) => any | Promise<any>
  ): { handler: Handler; options: RouteOptions } {
    return {
      handler,
      options: this.toRouteOptions()
    };
  }
}

export function contract<
  TParams extends TSchema = TSchema,
  TQuery extends TSchema = TSchema,
  THeaders extends TSchema = TSchema,
  TBody extends TSchema = TSchema,
  TResponse extends TSchema = TSchema
>(
  definition: ContractDefinition<TParams, TQuery, THeaders, TBody, TResponse>
): ApexContract<TParams, TQuery, THeaders, TBody, TResponse> {
  return new ApexContract(definition);
}

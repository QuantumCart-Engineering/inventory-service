import swaggerJSDoc from "swagger-jsdoc";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.3",

    info: {
      title: "QuantumCart Inventory Service API",
      version: "1.0.0",
      description:
        "Inventory management and stock reservation APIs for the QuantumCart distributed e-commerce platform."
    },

    servers: [
      {
        url: "http://localhost:8005",
        description: "Local development server"
      }
    ],

    tags: [
      {
        name: "Inventory",
        description:
          "Inventory management and reservation operations"
      }
    ],

    components: {
      schemas: {
        CreateInventoryRequest: {
          type: "object",
          required: [
            "productId",
            "initialQuantity"
          ],
          properties: {
            productId: {
              type: "string",
              description:
                "Unique product identifier",
              example:
                "11111111-1111-1111-1111-111111111111"
            },
            initialQuantity: {
              type: "integer",
              minimum: 0,
              description:
                "Initial available inventory quantity",
              example: 100
            }
          }
        },

        ReserveInventoryRequest: {
          type: "object",
          required: [
            "productId",
            "orderId",
            "quantity"
          ],
          properties: {
            productId: {
              type: "string",
              description:
                "Unique product identifier",
              example:
                "11111111-1111-1111-1111-111111111111"
            },
            orderId: {
              type: "string",
              description:
                "Unique order identifier",
              example:
                "22222222-2222-2222-2222-222222222222"
            },
            quantity: {
              type: "integer",
              minimum: 1,
              description:
                "Quantity to reserve",
              example: 2
            }
          }
        },

        ConfirmInventoryRequest: {
          type: "object",
          required: ["orderId"],
          properties: {
            orderId: {
              type: "string",
              description:
                "Order identifier associated with the reservation",
              example:
                "22222222-2222-2222-2222-222222222222"
            }
          }
        },

        ReleaseInventoryRequest: {
          type: "object",
          required: ["orderId"],
          properties: {
            orderId: {
              type: "string",
              description:
                "Order identifier associated with the reservation",
              example:
                "22222222-2222-2222-2222-222222222222"
            }
          }
        },

        Inventory: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example:
                "33333333-3333-3333-3333-333333333333"
            },
            product_id: {
              type: "string",
              example:
                "11111111-1111-1111-1111-111111111111"
            },
            available_quantity: {
              type: "integer",
              example: 98
            },
            reserved_quantity: {
              type: "integer",
              example: 2
            },
            created_at: {
              type: "string",
              format: "date-time"
            },
            updated_at: {
              type: "string",
              format: "date-time"
            }
          }
        },

        InventoryReservation: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example:
                "44444444-4444-4444-4444-444444444444"
            },
            product_id: {
              type: "string",
              example:
                "11111111-1111-1111-1111-111111111111"
            },
            order_id: {
              type: "string",
              example:
                "22222222-2222-2222-2222-222222222222"
            },
            quantity: {
              type: "integer",
              example: 2
            },
            status: {
              type: "string",
              enum: [
                "RESERVED",
                "CONFIRMED",
                "RELEASED"
              ],
              example: "RESERVED"
            }
          }
        },

        ReserveInventoryResponse: {
          type: "object",
          properties: {
            inventory: {
              $ref: "#/components/schemas/Inventory"
            },
            reservation: {
              $ref: "#/components/schemas/InventoryReservation"
            }
          }
        },

        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false
            },
            message: {
              type: "string",
              example:
                "Insufficient inventory"
            }
          }
        }
      }
    }
  },

  apis: [
    "./src/routes/*.ts"
  ],

  failOnErrors: true
};

export const swaggerSpec =
  swaggerJSDoc(options);
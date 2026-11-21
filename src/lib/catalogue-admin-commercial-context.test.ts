import { describe, expect, it } from "vitest";
import { buildAdminCommercialPreviewContext } from "@/lib/catalogue-admin-commercial-context";

const brands=[
  {id:"b1",slug:"biodance",active:true},
  {id:"b2",slug:"other-brand",active:true},
  {id:"b3",slug:"retired",active:false},
];
const products=[
  {id:"p1",brand_id:"b1",active:true},
  {id:"p2",brand_id:"b2",active:true},
  {id:"p3",brand_id:"b1",active:false},
];
const groups=[
  {id:"g1",brand_id:"b1",name:"Masques",active:true,minimum_total_units:12,quantity_multiple:4},
  {id:"g2",brand_id:"b2",name:"Autre gamme",active:true,minimum_total_units:6,quantity_multiple:6},
];
const groupProducts=[
  {group_id:"g1",product_id:"p1"},{group_id:"g1",product_id:"p3"},
  {group_id:"g2",product_id:"p2"},
];
const suppliers=[
  {id:"s1",display_name:"Distribution A",active:true},
  {id:"s2",display_name:"Distribution B",active:true},
];
const supplierBrands=[
  {supplier_id:"s1",brand_id:"b1"},{supplier_id:"s2",brand_id:"b2"},
];
const terms=[
  {supplier_id:"s1",active:true,verified_at:"2026-11-21T08:00:00Z",
    minimum_order_units:12,minimum_order_ht:200,shipping_fee_ht:10,free_shipping_from_ht:250,
    gift_rules:[{minimum_order_units:24,free_units:2,description:"24 + 2"}]},
  {supplier_id:"s2",active:true,verified_at:null,
    minimum_order_units:6,minimum_order_ht:250,shipping_fee_ht:20,free_shipping_from_ht:400,
    gift_rules:[{minimum_order_units:6,free_units:1}]},
];

const view=(allowedBrandIds:string[])=>buildAdminCommercialPreviewContext({
  allowedBrandIds,brands,products,groups,groupProducts,suppliers,supplierBrands,terms,
});

describe("single-agent commercial basket preview",()=>{
  it("shows only authorised published brand, product and active quantity group",()=>{
    const context=view(["b1"]);
    expect(context.quantity_groups).toEqual([{
      id:"g1",brand_slug:"biodance",name:"Masques",
      minimum_total_units:12,quantity_multiple:4,product_ids:["p1"],
    }]);
    expect(context.suppliers.map(s=>s.brand_slugs)).toEqual([["biodance"]]);
  });

  it("retains real verified supplier conditions for a pharmacy",()=>{
    expect(view(["b1"]).suppliers[0]).toMatchObject({
      conditions_verified:true,minimum_order_units:12,minimum_order_ht:200,
      shipping_fee_ht:10,free_shipping_from_ht:250,
      gift_rules:[{minimum_order_units:24,free_units:2,description:"24 + 2"}],
    });
  });

  it("never represents unverified supplier terms as confirmed",()=>{
    expect(view(["b2"]).suppliers[0]).toMatchObject({
      conditions_verified:false,minimum_order_units:null,
      minimum_order_ht:null,shipping_fee_ht:null,free_shipping_from_ht:null,
      gift_rules:[],
    });
  });

  it("returns no suppliers, quantity groups or cross-account details without brand permission",()=>{
    expect(view([])).toEqual({quantity_groups:[],suppliers:[]});
  });
});
